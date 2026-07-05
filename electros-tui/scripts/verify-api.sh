#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-127.0.0.1}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local url="$2"
  if curl -sf "$url" >/dev/null; then
    echo "OK  $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL $name ($url)"
    FAIL=$((FAIL + 1))
  fi
}

echo "Electros TUI API verification against $HOST"
echo "Ensure synthetic-daemons or client daemons are running."
echo

check "auth health"      "http://${HOST}:47777/"
check "auth status"      "http://${HOST}:47777/api/v1/authenticate/status"
check "compute health"   "http://${HOST}:17777/"
check "compute vms"      "http://${HOST}:17777/api/v1.0/client/vm/status"
check "storage health"   "http://${HOST}:27777/"
check "storage volumes"  "http://${HOST}:27777/api/v1.0/client/volume/accessible"
check "network health"   "http://${HOST}:37777/"
check "network list"     "http://${HOST}:37777/api/v1.0/client/network/list"
check "targets health"   "http://${HOST}:57777/"
check "targets list"     "http://${HOST}:57777/api/v1.0/client/target/list"
check "services health"  "http://${HOST}:6777/"
check "mcp health"       "http://${HOST}:7782/proxy/llm/agent/threads?limit=1"

echo
echo "Login mutation test"
LOGIN_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "http://${HOST}:47777/api/v1/authenticate/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo","password":"demo"}')
if [[ "$LOGIN_CODE" == "200" ]]; then
  echo "OK  auth login"
  PASS=$((PASS + 1))
else
  echo "FAIL auth login (HTTP $LOGIN_CODE)"
  FAIL=$((FAIL + 1))
fi

echo
echo "Results: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
