"""Local Phase 5 fixture that fails the first delivery attempt per event."""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer


records = {}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/notifications":
            self.send_error(404)
            return
        event = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        key = self.headers.get("Idempotency-Key")
        if not key or key != event.get("eventId"):
            self.send_error(400)
            return
        record = records.setdefault(key, {"attempts": 0, "accepted": 0, "payload": event})
        record["attempts"] += 1
        if record["attempts"] == 1:
            self.send_error(503)
            return
        record["accepted"] = 1
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        key = self.path.removeprefix("/records/")
        if key not in records:
            self.send_error(404)
            return
        body = json.dumps(records[key]).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


HTTPServer(("0.0.0.0", 8091), Handler).serve_forever()
