"""Exercise Monitor CRUD against a running OpsPilot monitor service."""

import json
import os
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from uuid import UUID, uuid4


BASE_URL = os.environ.get("MONITOR_BASE_URL", "http://127.0.0.1:8081").rstrip("/")
COLLECTION = "/api/monitors"


def request(method, path, expected_status, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    req = Request(BASE_URL + path, data=body, headers=headers, method=method)
    try:
        response = urlopen(req, timeout=10)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read()
        if response.status == 404 and path == COLLECTION:
            raise SystemExit(
                f"Monitor CRUD is unavailable at {BASE_URL}{COLLECTION}. "
                "If you are using Compose, rebuild the service with "
                "`docker compose up -d --build --wait monitor-service`. "
                "Otherwise, check MONITOR_BASE_URL and the running Monitor service version."
            )
        assert response.status == expected_status, (method, path, response.status, raw)
        print(f"{method} {path} → {response.status}")
        result = json.loads(raw) if raw and expected_status < 400 else None
        return result, response.headers


def main():
    config = {
        "name": f"CRUD test {uuid4()}",
        "url": "https://example.com/health",
        "intervalSeconds": 30,
        "timeoutSeconds": 5,
        "enabled": False,
    }
    request("GET", "/actuator/health", 200)
    request("POST", COLLECTION, 400, {**config, "url": "file:///tmp/test"})
    request("POST", COLLECTION, 400, {**config, "name": " ", "intervalSeconds": 0})
    request("POST", COLLECTION, 400, {**config, "enabled": None})
    created, headers = request("POST", COLLECTION, 201, config)
    path = f"{COLLECTION}/{UUID(created['id'])}"
    deleted = False
    try:
        assert urlparse(headers["Location"]).path == path
        assert all(created[key] == value for key, value in config.items())
        assert created["status"] == "UNKNOWN" and created["consecutiveFailures"] == 0
        assert created["createdAt"] == created["updatedAt"]
        assert request("GET", path, 200)[0] == created
        assert created in request("GET", COLLECTION, 200)[0]

        replacement = {
            **config,
            "name": config["name"] + " updated",
            "url": "http://example.com/ready",
            "intervalSeconds": 60,
            "timeoutSeconds": 10,
            "enabled": False,
        }
        request("PUT", path, 400, {"name": "incomplete"})
        updated, _ = request("PUT", path, 200, replacement)
        assert all(updated[key] == value for key, value in replacement.items())
        for key in ("id", "status", "consecutiveFailures", "createdAt"):
            assert updated[key] == created[key]
        assert updated["updatedAt"] != created["updatedAt"]

        request("PATCH", path + "/enabled", 400, {})
        for enabled in (True, False):
            patched, _ = request("PATCH", path + "/enabled", 200, {"enabled": enabled})
            assert patched["enabled"] == enabled
            assert patched["updatedAt"] != updated["updatedAt"]
            for key in updated.keys() - {"enabled", "updatedAt", "status", "consecutiveFailures"}:
                assert patched[key] == updated[key]
            updated = patched
        assert request("GET", path, 200)[0] == updated

        request("DELETE", path, 204)
        deleted = True
        assert all(item["id"] != created["id"] for item in request("GET", COLLECTION, 200)[0])
        request("GET", path, 404)
        request("PUT", path, 404, config)
        request("PATCH", path + "/enabled", 404, {"enabled": True})
        request("DELETE", path, 404)
        request("GET", COLLECTION + "/invalid-uuid", 400)
    finally:
        if not deleted:
            request("DELETE", path, 204)

    print("All Monitor CRUD checks passed.")


if __name__ == "__main__":
    main()
