"""Run the scheduled monitoring checks with the Compose development fixture."""

import argparse
import subprocess
import time
from pathlib import Path
from runpy import run_path
from uuid import UUID, uuid4

api = run_path(str(Path(__file__).with_name("test-monitor-api.py")))
COLLECTION = api["COLLECTION"]
request = api["request"]

FIXTURE = "http://monitor-fixture:8090"
COMPOSE = ["docker", "compose", "-f", "compose.yml", "-f", "compose.monitor-dev.yml"]


def config(url):
    return {"name": "Scheduled check test", "url": url,
            "intervalSeconds": 1, "timeoutSeconds": 2, "enabled": True}


def query_database(compose, sql):
    try:
        result = subprocess.run(compose + [
            "exec", "-T", "postgres", "psql", "-XAt", "-v", "ON_ERROR_STOP=1",
            "-U", "postgres", "-d", "monitor_db", "-c", sql,
        ], text=True, capture_output=True, check=True)
    except subprocess.CalledProcessError as error:
        detail = error.stderr.strip() or f"exit status {error.returncode}"
        hint = ""
        if compose[0] == "docker" and "permission denied" in detail.lower():
            hint = "\nIf you start Compose with sudo, rerun with --sudo-docker."
        raise SystemExit(f"Cannot query Monitor check history through Compose: {detail}{hint}") from None
    except FileNotFoundError as error:
        raise SystemExit(f"Required command unavailable: {error.filename}") from None
    return result.stdout


def history(compose, monitor_id):
    # Read-only query against the database. UUID parsing makes interpolation safe.
    monitor_id = UUID(monitor_id)
    sql = f"""
        SELECT http_status, error IS NOT NULL, response_time_ms >= 0, checked_at IS NOT NULL
        FROM monitor_checks WHERE monitor_id = '{monitor_id}' ORDER BY id
    """
    output = query_database(compose, sql)
    return [tuple(row.split("|")) for row in output.splitlines()]


def wait_for(monitor_id, predicate):
    deadline = time.monotonic() + 75
    while time.monotonic() < deadline:
        monitor, _ = request("GET", f"{COLLECTION}/{monitor_id}", 200)
        if predicate(monitor):
            return monitor
        time.sleep(1)
    raise AssertionError(f"Monitor {monitor_id} did not reach the expected state")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sudo-docker", action="store_true", help="Run Docker commands through sudo")
    args = parser.parse_args()
    compose = ["sudo", *COMPOSE] if args.sudo_docker else COMPOSE
    query_database(compose, "SELECT 1 FROM monitor_checks LIMIT 0")

    for url in (
        "file:///etc/passwd", "http://127.0.0.1:8080", "http://2130706433",
        "http://10.0.0.1", "http://[::1]", "http://[::ffff:127.0.0.1]",
        "http://169.254.169.254", "http://168.63.129.16",
        "http://metadata.google.internal", "http://100.100.100.200",
        "http://monitor-fixture-blocked:8090/ok", "http://monitor-fixture:8091/ok",
        "http://user:pass@monitor-fixture:8090/ok",
    ):
        request("POST", COLLECTION, 400, config(url))

    ids = []
    token = uuid4().hex

    def create(path):
        monitor, _ = request("POST", COLLECTION, 201, config(FIXTURE + path))
        ids.append(monitor["id"])
        return monitor["id"]

    try:
        sequence = create("/sequence/" + token)
        safe = create("/redirect-safe")
        blocked = create("/redirect-blocked/" + token)
        slow = create("/slow")
        wait_for(sequence, lambda m: m["status"] == "UP" and m["consecutiveFailures"] == 0)
        wait_for(sequence, lambda m: m["status"] == "DOWN" and m["consecutiveFailures"] >= 3)
        wait_for(sequence, lambda m: m["status"] == "UP" and m["consecutiveFailures"] == 0)
        wait_for(safe, lambda m: m["status"] == "UP")
        wait_for(blocked, lambda m: m["status"] == "DOWN")
        wait_for(slow, lambda m: m["status"] == "DOWN")

        rows = history(compose, sequence)
        assert [row[0] for row in rows[:6]] == ["200", "503", "503", "503", "200", "200"], rows
        assert all(row[2:] == ("t", "t") for row in rows)
        assert history(compose, safe)[0] == ("200", "f", "t", "t")
        assert history(compose, blocked)[0] == ("302", "t", "t", "t")
        assert history(compose, slow)[0] == ("", "t", "t", "t")

        request("PATCH", f"{COLLECTION}/{safe}/enabled", 200, {"enabled": False})
        previous_count = len(history(compose, safe))
        time.sleep(7)
        assert len(history(compose, safe)) == previous_count
    finally:
        for monitor_id in ids:
            request("DELETE", f"{COLLECTION}/{monitor_id}", 204)

    print("All scheduled monitoring and SSRF checks passed.")


if __name__ == "__main__":
    main()
