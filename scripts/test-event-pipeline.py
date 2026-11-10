"""Verify the Monitor → RabbitMQ → Incident → Notification pipeline in Compose."""

import argparse
import json
import subprocess
import time
from datetime import datetime
from pathlib import Path
from runpy import run_path
from uuid import UUID, uuid4

checks = run_path(str(Path(__file__).with_name("test-monitor-checks.py")))
request = checks["request"]
query = checks["query_database"]
collection = checks["COLLECTION"]


def published_events(compose, database, monitor_id):
    rows = query(compose, f"""
        SELECT payload::text FROM event_outbox
        WHERE payload->>'monitorId' = '{monitor_id}' AND published_at IS NOT NULL
        ORDER BY sequence
    """, database)
    return [json.loads(row) for row in rows.splitlines()]


def notification(compose, event):
    event_id = UUID(event["eventId"])
    result = subprocess.run(compose + [
        "exec", "-T", "notification-service", "cat", f"/app/data/{event_id}.json",
    ], text=True, capture_output=True)
    if result.returncode != 0:
        return None
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sudo-docker", action="store_true", help="Run Docker commands through sudo")
    args = parser.parse_args()
    compose = ["sudo", *checks["COMPOSE"]] if args.sudo_docker else checks["COMPOSE"]
    for database in ("monitor_db", "incident_db"):
        query(compose, "SELECT 1 FROM event_outbox LIMIT 0", database)

    token = uuid4().hex
    monitor, _ = request("POST", collection, 201, {
        **checks["config"](f'{checks["FIXTURE"]}/sequence/{token}'),
        "name": f"Phase 3 event test {token}",
    })
    monitor_id = UUID(monitor["id"])
    try:
        deadline = time.monotonic() + 100
        while time.monotonic() < deadline:
            monitor_events = published_events(compose, "monitor_db", monitor_id)
            incident_events = published_events(compose, "incident_db", monitor_id)
            if len(monitor_events) >= 2 and len(incident_events) >= 2:
                records = [notification(compose, event) for event in incident_events]
                if all(record is not None for record in records):
                    break
            time.sleep(2)
        else:
            raise AssertionError(f"Timed out waiting for published events and notification records for {monitor_id}")

        assert [event["type"] for event in monitor_events] == ["monitor.down", "monitor.recovered"]
        assert [event["type"] for event in incident_events] == ["incident.opened", "incident.resolved"]
        event_ids = {UUID(event["eventId"]) for event in monitor_events + incident_events}
        assert len(event_ids) == 4
        incident_id = UUID(incident_events[0]["incidentId"])
        assert UUID(incident_events[1]["incidentId"]) == incident_id

        incoming_ids = ", ".join(f"'{UUID(event['eventId'])}'" for event in monitor_events)
        processed = query(compose, f"""
            SELECT count(*) FROM processed_monitor_events WHERE event_id IN ({incoming_ids})
        """, "incident_db").strip()
        assert processed == "2"
        incidents = query(compose, f"""
            SELECT id, resolved_at >= opened_at FROM incidents WHERE monitor_id = '{monitor_id}'
        """, "incident_db").splitlines()
        assert incidents == [f"{incident_id}|t"], incidents
        for event, record in zip(incident_events, records):
            for key in ("eventId", "type", "version", "monitorId", "incidentId"):
                assert record[key] == event[key], (key, record, event)
            assert datetime.fromisoformat(record["occurredAt"]) == datetime.fromisoformat(event["occurredAt"])
        print("PASS monitor.down → incident.opened → notification record")
        print("PASS monitor.recovered → incident.resolved → notification record")
    finally:
        request("DELETE", f"{collection}/{monitor_id}", 204)

    print("Phase 3 event pipeline passed.")


if __name__ == "__main__":
    main()
