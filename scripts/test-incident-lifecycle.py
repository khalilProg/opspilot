"""Verify the Incident API and RabbitMQ lifecycle on the local Compose stack."""

import argparse
import json
import os
import time
from pathlib import Path
from runpy import run_path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import UUID, uuid4

checks = run_path(str(Path(__file__).with_name("test-monitor-checks.py")))
query = checks["query_database"]
base_url = os.environ.get("INCIDENT_BASE_URL", "http://127.0.0.1:8082").rstrip("/")
collection = "/api/incidents"


def request(method, path, expected_status):
    try:
        response = urlopen(Request(base_url + path, method=method), timeout=10)
    except HTTPError as error:
        response = error
    with response:
        body = response.read()
        assert response.status == expected_status, (method, path, response.status, body)
        print(f"{method} {path} → {response.status}")
        return json.loads(body) if expected_status == 200 else None


def wait_for(label, condition):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if condition():
            return
        time.sleep(1)
    raise AssertionError(f"Timed out waiting for {label}")


def exercise(send):
    monitor_id = uuid4()
    first_event = uuid4()
    reason = "Phase 4 test: HTTP 503"

    def incidents():
        return [item for item in request("GET", collection, 200) if item["monitorId"] == str(monitor_id)]

    def history(path):
        return [(row["fromStatus"], row["toStatus"]) for row in request("GET", path + "/transitions", 200)]

    missing = f"{collection}/{uuid4()}"
    request("GET", missing, 404)
    request("GET", missing + "/transitions", 404)
    request("POST", missing + "/acknowledge", 404)
    request("GET", collection + "/invalid-uuid", 400)
    send(first_event, monitor_id, "monitor.down", reason)
    opened, = incidents()
    assert opened["status"] == "OPEN" and opened["reason"] == reason
    assert opened["openedAt"] and opened["acknowledgedAt"] is None and opened["resolvedAt"] is None
    path = f"{collection}/{UUID(opened['id'])}"
    assert history(path) == [(None, "OPEN")]

    send(first_event, monitor_id, "monitor.down", reason)
    send(uuid4(), monitor_id, "monitor.down")
    assert incidents() == [opened]
    acknowledged = request("POST", path + "/acknowledge", 200)
    assert acknowledged["status"] == "ACKNOWLEDGED" and acknowledged["acknowledgedAt"]
    assert request("POST", path + "/acknowledge", 200) == acknowledged

    send(uuid4(), monitor_id, "monitor.recovered")
    resolved = request("GET", path, 200)
    assert resolved["status"] == "RESOLVED" and resolved["resolvedAt"]
    assert resolved["acknowledgedAt"] == acknowledged["acknowledgedAt"]
    assert history(path) == [(None, "OPEN"), ("OPEN", "ACKNOWLEDGED"), ("ACKNOWLEDGED", "RESOLVED")]
    request("POST", path + "/acknowledge", 409)

    send(first_event, monitor_id, "monitor.down", reason)
    # A distinct recovery event acts as a queue barrier after the replay.
    send(uuid4(), monitor_id, "monitor.recovered")
    assert incidents() == [resolved]
    send(uuid4(), monitor_id, "monitor.down")
    current, = [item for item in incidents() if item["status"] == "OPEN"]
    assert current["id"] != opened["id"] and current["reason"] == "Monitor reported DOWN"
    current_path = f"{collection}/{UUID(current['id'])}"
    send(uuid4(), monitor_id, "monitor.recovered")
    direct = request("GET", current_path, 200)
    assert direct["status"] == "RESOLVED" and direct["acknowledgedAt"] is None
    assert history(current_path) == [(None, "OPEN"), ("OPEN", "RESOLVED")]
    assert len(incidents()) == 2
    print(f"Phase 4 incident lifecycle checks passed for synthetic monitor {monitor_id}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sudo-docker", action="store_true", help="Run Docker commands through sudo")
    args = parser.parse_args()
    compose = ["sudo", "docker", "compose"] if args.sudo_docker else ["docker", "compose"]
    query(compose, "SELECT 1 FROM event_outbox LIMIT 0")
    query(compose, "SELECT 1 FROM incident_transitions LIMIT 0", "incident_db")

    def send(event_id, monitor_id, routing_key, reason=None):
        assert routing_key in {"monitor.down", "monitor.recovered"}
        reason_sql = "NULL" if reason is None else "'" + reason.replace("'", "''") + "'"
        query(compose, f"""
            INSERT INTO event_outbox (event_id, routing_key, payload)
            VALUES ('{event_id}', '{routing_key}', jsonb_strip_nulls(jsonb_build_object(
                'eventId', '{event_id}'::uuid, 'type', '{routing_key}'::text, 'version', 1,
                'monitorId', '{monitor_id}'::uuid, 'occurredAt', CURRENT_TIMESTAMP,
                'reason', {reason_sql}::text)))
            ON CONFLICT (event_id) DO UPDATE SET published_at = NULL
        """)
        wait_for(f"publication of {event_id}", lambda: query(compose, f"""
            SELECT 1 FROM event_outbox WHERE event_id = '{event_id}' AND published_at IS NOT NULL
        """).strip())
        wait_for(f"processing of {event_id}", lambda: query(compose, f"""
            SELECT 1 FROM processed_monitor_events WHERE event_id = '{event_id}'
        """, "incident_db").strip())

    exercise(send)


if __name__ == "__main__":
    main()
