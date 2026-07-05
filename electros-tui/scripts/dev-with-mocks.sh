#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
SYNTHETIC="$REPO_ROOT/synthetic-daemons"
PERSIST=false

usage() {
  cat <<'EOF'
Usage: dev-with-mocks.sh [options]

Starts synthetic-daemons in the background, waits for health, then launches electros-tui.

Options:
  --persist-state   Pass --persist-state to synthetic-daemons
  --skip-health     Pass --skip-health to electros-tui
  -h, --help        Show this help
EOF
}

SKIP_HEALTH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --persist-state) PERSIST=true; shift ;;
    --skip-health) SKIP_HEALTH="--skip-health"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ ! -d "$SYNTHETIC/node_modules" ]]; then
  echo "Installing synthetic-daemons dependencies..."
  (cd "$SYNTHETIC" && npm install)
fi

DAEMON_ARGS=()
if $PERSIST; then
  DAEMON_ARGS+=(--persist-state)
fi

echo "Starting synthetic-daemons..."
(cd "$SYNTHETIC" && npm run build >/dev/null 2>&1 || true)
(cd "$SYNTHETIC" && node dist/index.js "${DAEMON_ARGS[@]}") &
DAEMON_PID=$!

cleanup() {
  echo
  echo "Stopping synthetic-daemons (pid $DAEMON_PID)..."
  kill "$DAEMON_PID" 2>/dev/null || true
  wait "$DAEMON_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

ports=(47777 17777 27777 37777 57777 6777)
echo "Waiting for daemon ports: ${ports[*]}"
for port in "${ports[@]}"; do
  for _ in $(seq 1 60); do
    if curl -sf "http://127.0.0.1:${port}/" >/dev/null 2>&1; then
      echo "  port $port ok"
      break
    fi
    sleep 0.25
  done
done

ECD_DIR="$REPO_ROOT/elemento-gui-new/electros/ecd"
if [[ ! -f "$ECD_DIR/networking.json" ]]; then
  echo "ECD not found at $ECD_DIR" >&2
  exit 1
fi

echo "Building electros-tui..."
(cd "$ROOT" && go build -o bin/electros-tui ./cmd/electros-tui)

echo "Launching electros-tui (Ctrl+C quits both)..."
exec "$ROOT/bin/electros-tui" \
  --ecd-dir "$ECD_DIR" \
  --host 127.0.0.1 \
  $SKIP_HEALTH
