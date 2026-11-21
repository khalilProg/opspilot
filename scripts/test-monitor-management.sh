#!/usr/bin/env sh
set -eu

repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ ! -x "$repo/tests/e2e/node_modules/.bin/playwright" ]; then
  printf '%s\n' 'Install the browser test dependencies first:' \
    '  npm ci --prefix tests/e2e' \
    '  npm exec --prefix tests/e2e -- playwright install chromium' >&2
  exit 1
fi

exec npm --prefix "$repo/tests/e2e" test -- monitor-management.spec.js "$@"
