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


def verify_outage(compose, monitor_id, token):
    deadline = time.monotonic() + 100
    while time.monotonic() < deadline:
        events = published_events(compose, "incident_db", monitor_id)
        if events and notification(compose, events[0]) is not None:
            assert [event["type"] for event in events] == ["incident.opened"]
            incident_id = UUID(events[0]["incidentId"])
            active = query(compose, f"""
                SELECT id, status FROM incidents WHERE monitor_id = '{monitor_id}' AND resolved_at IS NULL
            """, "incident_db").splitlines()
            assert active == [f"{incident_id}|OPEN"], active
            assert request("GET", f"{collection}/{monitor_id}", 200)[0]["status"] == "DOWN"
            print("PASS exactly one active incident and an opened notification during the outage")
            break
        time.sleep(2)
    else:
        raise AssertionError(f"Timed out waiting for the active incident and notification for {monitor_id}")

    subprocess.run(compose + [
        "exec", "-T", "monitor-fixture", "python", "-c",
        "import sys, urllib.request; "
        "urllib.request.urlopen(urllib.request.Request(sys.argv[1], method='POST'), timeout=5).close()",
        f"http://127.0.0.1:8090/recover/{token}",
    ], check=True)


def verify_restart(compose, monitor_id, incident_id, events, records):
    # Freeze this monitor so scheduled checks cannot change state during the comparison.
    path = f"{collection}/{monitor_id}"
    monitor, _ = request("PATCH", path + "/enabled", 200, {"enabled": False})
    assert monitor["status"] == "UP"
    history_sql = f"""
        SELECT row_to_json(check_row) FROM monitor_checks AS check_row
        WHERE monitor_id = '{monitor_id}' ORDER BY id
    """
    history = query(compose, history_sql)
    incident_request = run_path(str(Path(__file__).with_name("test-incident-lifecycle.py")))["request"]
    incident_path = f"/api/incidents/{incident_id}"
    incident = incident_request("GET", incident_path, 200)
    transitions = incident_request("GET", incident_path + "/transitions", 200)

    subprocess.run(compose + ["restart", "monitor-service", "incident-service", "notification-service"], check=True)
    subprocess.run(compose + [
        "up", "-d", "--wait", "--wait-timeout", "120", "--no-recreate", "--no-deps",
        "monitor-service", "incident-service", "notification-service",
    ], check=True)

    assert request("GET", path, 200)[0] == monitor
    assert query(compose, history_sql) == history
    assert incident_request("GET", incident_path, 200) == incident
    assert incident_request("GET", incident_path + "/transitions", 200) == transitions
    assert [notification(compose, event) for event in events] == records
    print("PASS all three application containers retained persisted state across restart")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sudo-docker", action="store_true", help="Run Docker commands through sudo")
    parser.add_argument("--acceptance", action="store_true", help="Verify outage thresholds and restart persistence")
    args = parser.parse_args()
    compose = ["sudo", *checks["COMPOSE"]] if args.sudo_docker else checks["COMPOSE"]
    if args.acceptance:
        compose = [*compose, "-f", "compose.notification-dev.yml"]
    for database in ("monitor_db", "incident_db"):
        query(compose, "SELECT 1 FROM event_outbox LIMIT 0", database)

    token = uuid4().hex
    fixture_path = "acceptance" if args.acceptance else "sequence"
    monitor, _ = request("POST", collection, 201, {
        **checks["config"](f'{checks["FIXTURE"]}/{fixture_path}/{token}'),
        "name": f"Phase 3 event test {token}",
    })
    monitor_id = UUID(monitor["id"])
    try:
        if args.acceptance:
            verify_outage(compose, monitor_id, token)
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
        if args.acceptance:
            checks_at = query(compose, f"""
                SELECT http_status, checked_at FROM monitor_checks WHERE monitor_id = '{monitor_id}' ORDER BY id
            """).splitlines()
            statuses = [row.split("|")[0] for row in checks_at]
            checked_at = [datetime.fromisoformat(row.split("|")[1]) for row in checks_at]
            down_at, recovered_at = (datetime.fromisoformat(event["occurredAt"]) for event in monitor_events)
            down_index, recovered_index = checked_at.index(down_at), checked_at.index(recovered_at)
            assert down_index == 3 and statuses[:4] == ["200", "503", "503", "503"], statuses
            assert statuses[recovered_index - 2:recovered_index + 1] == ["503", "200", "200"], statuses
            print("PASS outage after exactly three failures and recovery after exactly two successes")
            verify_restart(compose, monitor_id, incident_id, incident_events, records)
    finally:
        request("DELETE", f"{collection}/{monitor_id}", 204)

    print("Phase 3 event pipeline passed.")


if __name__ == "__main__":
    main()
