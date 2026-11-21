#!/usr/bin/env sh
set -eu

base_url=${GATEWAY_BASE_URL:-http://localhost:3000}
base_url=${base_url%/}
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
trap 'exit 1' HUP INT TERM

check() {
  path=$1
  expected=$2
  response=$3
  shift 3

  if ! status=$(curl --silent --show-error --connect-timeout 3 --max-time 20 \
      --dump-header "$workdir/headers" --output "$workdir/body" \
      --write-out '%{http_code}' "$@" "$base_url$path"); then
    printf 'FAIL %s: unable to get a response\n' "$path" >&2
    exit 1
  fi
  if [ "$status" != "$expected" ]; then
    printf 'FAIL %s: expected HTTP %s, got %s\n' "$path" "$expected" "$status" >&2
    exit 1
  fi

  python3 - "$workdir" "$path" "$status" "$response" <<'PY'
import json
import re
import sys
from email.parser import BytesHeaderParser
from pathlib import Path

directory, path, status, response = sys.argv[1:]
header_blocks = Path(directory, "headers").read_bytes().strip().split(b"\r\n\r\n")
headers = BytesHeaderParser().parsebytes(header_blocks[-1].partition(b"\n")[2])
body = Path(directory, "body").read_bytes()
request_id = headers.get("X-Request-ID", "")
if not re.fullmatch("[0-9a-f]{32}", request_id):
    sys.exit(f"FAIL {path}: missing or invalid X-Request-ID")

content_type = headers.get_content_type()
if response == "html":
    valid = content_type == "text/html" and b"<title>OpsPilot</title>" in body
elif response == "private":
    valid = True
else:
    try:
        data = json.loads(body) if content_type == "application/json" else None
    except ValueError:
        data = None
    if response == "health":
        valid = data == {"status": "UP"}
    elif response == "collection":
        valid = isinstance(data, list)
    elif response == "unrouted":
        valid = data == {"error": "API route not found"}
    else:
        valid = isinstance(data, dict) and data.get("path") == path

if not valid:
    sys.exit(f"FAIL {path}: expected a {response} response, got {content_type}")
print(f"PASS {path} HTTP {status} (request {request_id})")
PY
}

printf 'Checking the OpsPilot gateway at %s\n' "$base_url"
check /healthz 200 health --retry 10 --retry-delay 1 --retry-connrefused --retry-max-time 30
check / 200 html
check /monitors 200 html
check /incidents 200 html
check /api/monitors 200 collection
check /api/incidents 200 collection
check /api/monitors 400 spring-error --header 'Content-Type: application/json' --data '{}'
missing_id=00000000-0000-0000-0000-000000000000
check "/api/monitors/$missing_id" 404 spring-error
check "/api/incidents/$missing_id/transitions" 404 spring-error
check /api/monitors-other 404 unrouted
check /api/info 404 unrouted
check /actuator/health 404 private
check /health 404 private
echo 'All OpsPilot gateway smoke checks passed.'
