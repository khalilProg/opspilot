#!/usr/bin/env sh
set -eu

check() {
  url="$1"
  echo "Checking $url"
  curl --fail --silent --show-error --retry 15 --retry-connrefused --retry-delay 2 "$url"
  printf '\n'
}
check http://127.0.0.1:8081/api/info
check http://127.0.0.1:8081/actuator/health
check http://127.0.0.1:8082/api/info
check http://127.0.0.1:8082/actuator/health
check http://127.0.0.1:8083/api/info
check http://127.0.0.1:8083/health
echo 'All OpsPilot smoke checks passed.'
