from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from os import environ
from threading import Lock
from time import sleep

counts = Counter()
lock = Lock()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/sequence/"):
            with lock:
                counts[self.path] += 1
                attempt = counts[self.path]
            self.send_response(503 if 2 <= attempt <= 4 else 200)
        elif self.path == "/redirect-safe":
            self.send_response(302)
            self.send_header("Location", "/ok")
        elif self.path.startswith("/redirect-blocked/"):
            self.send_response(302)
            blocked_host = environ.get("MONITOR_FIXTURE_BLOCKED_HOST", "monitor-fixture-blocked")
            token = self.path.rsplit("/", 1)[1]
            self.send_header("Location", f"http://{blocked_host}:8090/trap/{token}")
        elif self.path == "/slow":
            sleep(4)
            self.send_response(200)
        elif self.path == "/ok":
            self.send_response(200)
        else:
            self.send_response(404)
        try:
            self.end_headers()
        except (BrokenPipeError, ConnectionResetError):
            pass


ThreadingHTTPServer(("0.0.0.0", 8090), Handler).serve_forever()
