#!/usr/bin/env bash
# Setup and run synthetic HTTP client daemons for demos / exhibitions on macOS.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ELECTROS_ELECTRON_DIR="$REPO_ROOT/electros-electron"
MIN_NODE_MAJOR=20
AUTH_PORT=47777
DAEMON_PORTS=(47777 17777 27777 37777 57777 6777)

SETUP_ONLY=false
LAUNCH_ELECTROS=false
PERSIST_STATE=false
DAEMON_ARGS=()
DAEMON_PID=""

usage() {
  cat <<'EOF'
Usage: run-exhibition.sh [options]

Setup and run synthetic client daemons for Electros demos on macOS.

Options:
  --setup            Install npm dependencies and exit
  --launch-electros  Start daemons, then open Electros with --no-daemons
  --persist-state    Keep mutable demo state in /tmp/synthetic-daemons-state.json
  -h, --help         Show this help

Without --launch-electros, daemons run in the foreground (Ctrl+C to stop).

Electros is launched from, in order:
  1. $ELECTROS_APP if set
  2. /Applications/Electros.app
  3. electros-electron dev checkout (npm start -- --no-daemons)

Double-click "Run Synthetic Daemons.command" in Finder for the same script.
EOF
}

info() { printf '==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --setup) SETUP_ONLY=true ;;
      --launch-electros) LAUNCH_ELECTROS=true ;;
      --persist-state)
        PERSIST_STATE=true
        DAEMON_ARGS+=(--persist-state)
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "unknown option: $1 (try --help)"
        ;;
    esac
    shift
  done
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    die "Node.js ${MIN_NODE_MAJOR}+ is required. Install from https://nodejs.org/ or: brew install node"
  fi

  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$major" -lt "$MIN_NODE_MAJOR" ]]; then
    die "Node.js ${MIN_NODE_MAJOR}+ is required (found $(node -v))"
  fi
}

ensure_dependencies() {
  cd "$SCRIPT_DIR"
  if $SETUP_ONLY || [[ ! -d node_modules ]]; then
    info "Installing synthetic-daemons dependencies..."
    npm install
  else
    info "Dependencies already installed."
  fi
}

check_ports_available() {
  local busy=()
  for port in "${DAEMON_PORTS[@]}"; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      busy+=("$port")
    fi
  done

  if [[ ${#busy[@]} -eq 0 ]]; then
    return 0
  fi

  warn "these ports are already in use: ${busy[*]}"
  lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk -v ports="$(IFS=,; echo "${busy[*]}")" '
    BEGIN { split(ports, p, ",") }
    NR == 1 { print; next }
    {
      for (i in p) if ($9 ~ ":" p[i] "$") { print; break }
    }
  ' || true
  die "stop the other process or quit any existing synthetic daemons, then try again."
}

wait_for_daemons() {
  local attempts=40
  info "Waiting for synthetic daemons on port ${AUTH_PORT}..."
  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS -o /dev/null "http://127.0.0.1:${AUTH_PORT}/" 2>/dev/null; then
      info "Synthetic daemons are ready."
      return 0
    fi
    sleep 0.25
  done
  die "timed out waiting for synthetic daemons on port ${AUTH_PORT}"
}

start_daemons() {
  cd "$SCRIPT_DIR"
  info "Starting synthetic daemons (scenario: default)..."
  if [[ ${#DAEMON_ARGS[@]} -gt 0 ]]; then
    npm start -- "${DAEMON_ARGS[@]}" &
  else
    npm start &
  fi
  DAEMON_PID=$!
}

stop_daemons() {
  if [[ -n "$DAEMON_PID" ]] && kill -0 "$DAEMON_PID" 2>/dev/null; then
    info "Stopping synthetic daemons..."
    kill "$DAEMON_PID" 2>/dev/null || true
    wait "$DAEMON_PID" 2>/dev/null || true
  fi
}

resolve_electros_launcher() {
  if [[ -n "${ELECTROS_APP:-}" && -x "$ELECTROS_APP" ]]; then
    printf '%s' "$ELECTROS_APP"
    return 0
  fi

  local app_bundle="/Applications/Electros.app/Contents/MacOS/Electros"
  if [[ -x "$app_bundle" ]]; then
    printf '%s' "$app_bundle"
    return 0
  fi

  if [[ -f "$ELECTROS_ELECTRON_DIR/package.json" && -d "$ELECTROS_ELECTRON_DIR/node_modules" ]]; then
    printf 'dev'
    return 0
  fi

  return 1
}

launch_electros() {
  local launcher
  if ! launcher="$(resolve_electros_launcher)"; then
    cat >&2 <<'EOF'

Could not find Electros to launch automatically.

Install Electros to /Applications, set ELECTROS_APP to the binary path, or run
from a dev checkout:

  cd electros-electron && npm install && npm start -- --no-daemons

Daemons are running; leave this terminal open while using Electros.
EOF
    return 0
  fi

  info "Launching Electros with --no-daemons..."
  if [[ "$launcher" == "dev" ]]; then
    cd "$ELECTROS_ELECTRON_DIR"
    npm start -- --no-daemons
  else
    "$launcher" --no-daemons
  fi
}

print_ready_banner() {
  cat <<EOF

Synthetic daemons are running on localhost.
Keep this terminal open while demoing Electros.

Ports: auth 47777, compute 17777, storage 27777, network 37777,
       targets 57777, services 6777

Launch Electros separately with --no-daemons, or re-run with --launch-electros.

Quick check:
  curl -s http://127.0.0.1:${AUTH_PORT}/api/v1/authenticate/status

Press Ctrl+C to stop.
EOF
}

on_exit() {
  stop_daemons
}

main() {
  parse_args "$@"
  require_node
  ensure_dependencies

  if $SETUP_ONLY; then
    info "Setup complete."
    exit 0
  fi

  check_ports_available
  trap on_exit EXIT INT TERM

  if $LAUNCH_ELECTROS; then
    start_daemons
    wait_for_daemons
    launch_electros
    stop_daemons
    exit 0
  fi

  print_ready_banner
  cd "$SCRIPT_DIR"
  if [[ ${#DAEMON_ARGS[@]} -gt 0 ]]; then
    exec npm start -- "${DAEMON_ARGS[@]}"
  else
    exec npm start
  fi
}

main "$@"
