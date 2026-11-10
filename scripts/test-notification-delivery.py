"""Verify Phase 5 webhook delivery on the local Compose stack."""

import argparse
import json
import subprocess
from pathlib import Path
from runpy import run_path
from uuid import uuid4

pipeline = run_path(str(Path(__file__).with_name("test-event-pipeline.py")))
query = pipeline["query"]
receipt = pipeline["notification"]
wait_for = run_path(str(Path(__file__).with_name("test-event-reliability.py")))["wait_for"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sudo-docker", action="store_true", help="Run Docker commands through sudo")
    args = parser.parse_args()
    compose = ["docker", "compose", "-f", "compose.yml", "-f", "compose.notification-dev.yml"]
    if args.sudo_docker:
        compose.insert(0, "sudo")
    query(compose, "SELECT 1 FROM event_outbox LIMIT 0", "incident_db")
    monitor_id, incident_id = uuid4(), uuid4()

    def publish(event_id, event_type):
        query(compose, f"""
            INSERT INTO event_outbox (event_id, routing_key, payload)
            VALUES ('{event_id}', '{event_type}', jsonb_build_object(
                'eventId', '{event_id}'::uuid, 'type', '{event_type}'::text, 'version', 1,
                'monitorId', '{monitor_id}'::uuid, 'incidentId', '{incident_id}'::uuid,
                'occurredAt', CURRENT_TIMESTAMP))
            ON CONFLICT (event_id) DO UPDATE SET published_at = NULL
        """, "incident_db")
        wait_for(f"publication of {event_id}", lambda: query(compose, f"""
            SELECT 1 FROM event_outbox WHERE event_id = '{event_id}' AND published_at IS NOT NULL
        """, "incident_db").strip())

    def verify(event_id, event_type, title):
        record = wait_for(f"notification receipt {event_id}",
                          lambda: receipt(compose, {"eventId": str(event_id)}))
        output = subprocess.check_output(compose + [
            "exec", "-T", "notification-webhook", "python", "-c",
            "import sys, urllib.request; print(urllib.request.urlopen(sys.argv[1], timeout=5).read().decode())",
            f"http://127.0.0.1:8091/records/{event_id}",
        ], text=True)
        delivery = json.loads(output)
        assert delivery["attempts"] == 2 and delivery["accepted"] == 1, delivery
        assert delivery["payload"] == record
        assert record["title"] == title and record["type"] == event_type and record["message"]
        assert record["monitorId"] == str(monitor_id) and record["incidentId"] == str(incident_id)
        return record

    opened_id, resolved_id = uuid4(), uuid4()
    publish(opened_id, "incident.opened")
    original = verify(opened_id, "incident.opened", "Incident opened")
    print("PASS temporary webhook failure retried with the same event ID")
    subprocess.run(compose + ["restart", "notification-service"], check=True)
    publish(opened_id, "incident.opened")
    publish(resolved_id, "incident.resolved")
    verify(resolved_id, "incident.resolved", "Incident resolved")
    assert verify(opened_id, "incident.opened", "Incident opened") == original
    print("PASS consumer restarted, skipped the duplicate, and delivered the next event")
    print("Phase 5 notification delivery checks passed.")


if __name__ == "__main__":
    main()
