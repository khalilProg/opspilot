"""Replace the Monitor container and check that Nginx reconnects without a restart."""

import argparse
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
BASE = os.getenv("GATEWAY_BASE_URL", "http://localhost:3000").rstrip("/")
OUTAGE_MESSAGES = {
    502: "The API service is unavailable.",
    504: "The API service did not respond in time.",
}


def response(path):
    try:
        result = urlopen(BASE + path, timeout=20)
    except HTTPError as error:
        result = error
    with result:
        return result.status, result.headers, result.read()


def check_recovery():
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        try:
            status, _, body = response("/api/monitors")
            if status == 200:
                assert isinstance(json.loads(body), list)
                return
        except (TimeoutError, URLError):
            pass
        time.sleep(1)
    raise AssertionError("Monitor API did not recover through the gateway")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sudo-docker", action="store_true")
    args = parser.parse_args()
    docker = ["sudo", "docker"] if args.sudo_docker else ["docker"]
    compose = [*docker, "compose", "-f", "compose.yml", "-f", "compose.monitor-dev.yml",
               "-f", "compose.notification-dev.yml"]

    def container(service):
        identifier = subprocess.check_output([*compose, "ps", "-q", service], cwd=ROOT, text=True).strip()
        assert identifier, f"{service} must be running to test recovery"
        return identifier

    gateway_id = container("gateway")
    gateway_started = subprocess.check_output(
        [*docker, "inspect", "--format", "{{.State.StartedAt}}", gateway_id], text=True,
    )
    monitor_id = container("monitor-service")
    assert response("/api/monitors")[0] == 200
    try:
        subprocess.run([*compose, "stop", "monitor-service"], cwd=ROOT, check=True)
        status, headers, body = response("/api/monitors")
        assert status in OUTAGE_MESSAGES, (status, body)
        assert headers.get_content_type() == "application/json", headers
        assert headers.get("X-Request-ID"), headers
        assert json.loads(body) == {"message": OUTAGE_MESSAGES[status]}, (status, body)
        assert response("/api/incidents")[0] == 200
        assert response("/")[0] == 200
        print(f"PASS Monitor outage returns JSON {status} while the dashboard and Incident API stay available.")
    finally:
        subprocess.run([
            *compose, "up", "-d", "--no-build", "--no-deps", "--force-recreate",
            "--wait", "--wait-timeout", "120", "monitor-service",
        ], cwd=ROOT, check=True)

    assert container("monitor-service") != monitor_id, "Monitor container was not replaced"
    check_recovery()
    assert container("gateway") == gateway_id, "Gateway container was replaced"
    assert subprocess.check_output(
        [*docker, "inspect", "--format", "{{.State.StartedAt}}", gateway_id], text=True,
    ) == gateway_started, "Gateway restarted during recovery"
    print("PASS Monitor API recovered after container replacement without restarting Nginx.")


if __name__ == "__main__":
    main()
