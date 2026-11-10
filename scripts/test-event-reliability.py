"""Exercise RabbitMQ failure and replay behavior on the local development stack."""

import argparse
import subprocess
import time
from pathlib import Path
from runpy import run_path
from uuid import UUID, uuid4

pipeline = run_path(str(Path(__file__).with_name("test-event-pipeline.py")))
checks = pipeline["checks"]
query = pipeline["query"]
request = pipeline["request"]
collection = pipeline["collection"]
incident_queue = "incident.monitor-events"
notification_queue = "notification.incident-events"


def command(compose, *args):
    return subprocess.check_output([*compose, *args], text=True)


def wait_for(label, condition, timeout=100):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if result := condition():
            return result
        time.sleep(2)
    raise AssertionError(f"Timed out waiting for {label}")


def queues(compose):
    output = command(compose, "exec", "-T", "rabbitmq", "rabbitmqctl", "-q",
                     "list_queues", "name", "messages_ready", "messages_unacknowledged")
    counts = {}
    for line in output.splitlines():
        fields = line.split()
        if len(fields) == 3 and fields[1].isdigit() and fields[2].isdigit():
            name, ready, unacked = fields
            counts[name] = int(ready) + int(unacked)
    return counts


def notification_file(compose, event_id):
    return command(compose, "exec", "-T", "notification-service",
                   "stat", "-c", "%i:%y", f"/app/data/{UUID(event_id)}.json").strip()


def inject(compose, event_id, payload):
    query(compose, f"""
        INSERT INTO event_outbox (event_id, routing_key, payload)
        VALUES ('{event_id}', 'monitor.down', {payload})
    """)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sudo-docker", action="store_true", help="Run Docker commands through sudo")
    args = parser.parse_args()
    compose = ["sudo", *checks["COMPOSE"]] if args.sudo_docker else checks["COMPOSE"]
    for database in ("monitor_db", "incident_db"):
        query(compose, "SELECT 1 FROM event_outbox LIMIT 0", database)
    expected_queues = {incident_queue, notification_queue, incident_queue + ".dlq", notification_queue + ".dlq"}
    assert expected_queues <= queues(compose).keys(), "Start the full Phase 3 stack before running this test"

    monitor_id = None
    broker_stopped = False
    try:
        broker_stopped = True
        command(compose, "stop", "rabbitmq")
        monitor, _ = request("POST", collection, 201,
                             checks["config"](f'{checks["FIXTURE"]}/sequence/{uuid4().hex}'))
        monitor_id = UUID(monitor["id"])
        pending = wait_for("a pending monitor.down during the outage", lambda: query(compose, f"""
            SELECT event_id FROM event_outbox
            WHERE payload->>'monitorId' = '{monitor_id}'
              AND routing_key = 'monitor.down' AND published_at IS NULL
        """).strip())
        down_id = UUID(pending)
        command(compose, "start", "rabbitmq")
        broker_stopped = False

        def recovered_pipeline():
            events = pipeline["published_events"](compose, "incident_db", monitor_id)
            if [event["type"] for event in events] == ["incident.opened", "incident.resolved"]:
                if all(pipeline["notification"](compose, event) is not None for event in events):
                    return events
            return None

        incident_events = wait_for("incident and notification delivery after broker restart", recovered_pipeline)
        assert any(event["eventId"] == str(down_id)
                   for event in pipeline["published_events"](compose, "monitor_db", monitor_id))
        print("PASS broker outage retained the event and recovery delivered the same ID")

        opened_id = UUID(incident_events[0]["eventId"])
        original_file = notification_file(compose, str(opened_id))
        for database, event_id in (("monitor_db", down_id), ("incident_db", opened_id)):
            query(compose, f"UPDATE event_outbox SET published_at = NULL WHERE event_id = '{event_id}'", database)
            wait_for(f"replay of {event_id}", lambda: query(compose, f"""
                SELECT 1 FROM event_outbox WHERE event_id = '{event_id}' AND published_at IS NOT NULL
            """, database).strip())
        def deliveries_drained():
            counts = queues(compose)
            return counts.get(incident_queue) == counts.get(notification_queue) == 0

        wait_for("replayed deliveries to drain", deliveries_drained)
        assert query(compose, f"SELECT count(*) FROM incidents WHERE monitor_id = '{monitor_id}'",
                     "incident_db").strip() == "1"
        assert notification_file(compose, str(opened_id)) == original_file
        print("PASS duplicate events left one incident and the original notification file")

        dlq = incident_queue + ".dlq"
        baseline = queues(compose)[dlq]
        inject(compose, uuid4(), "'{}'::jsonb")
        wait_for("malformed event in incident DLQ", lambda: queues(compose)[dlq] == baseline + 1)
        print("PASS malformed event reached the dead-letter queue")

        failing_id = uuid4()
        constraint = f"reliability_test_{failing_id.hex}"
        query(compose, f"""
            ALTER TABLE processed_monitor_events ADD CONSTRAINT {constraint}
            CHECK (event_id <> '{failing_id}') NOT VALID
        """, "incident_db")
        try:
            inject(compose, failing_id, f"""jsonb_build_object(
                'eventId', '{failing_id}'::uuid, 'type', 'monitor.down', 'version', 1,
                'monitorId', '{monitor_id}'::uuid, 'occurredAt', CURRENT_TIMESTAMP)""")
            wait_for("retry exhaustion in incident DLQ", lambda: queues(compose)[dlq] == baseline + 2)
            logs = command(compose, "logs", "--no-color", "incident-service")
            assert logs.count(f"Could not process monitor event {failing_id}") >= 2
            print("PASS repeated processing failures exhausted retries and reached the dead-letter queue")
        finally:
            query(compose, f"ALTER TABLE processed_monitor_events DROP CONSTRAINT {constraint}", "incident_db")
    finally:
        try:
            if broker_stopped:
                command(compose, "start", "rabbitmq")
        finally:
            if monitor_id is not None:
                request("DELETE", f"{collection}/{monitor_id}", 204)
    print("Phase 3 reliability checks passed.")


if __name__ == "__main__":
    main()
