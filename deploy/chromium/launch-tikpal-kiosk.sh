#!/usr/bin/env bash
set -euo pipefail

MODE="launch"
if [[ "${1:-}" == "--check" ]]; then
  MODE="check"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
TIKPAL_KIOSK_URL="${TIKPAL_KIOSK_URL:-http://localhost:4173/flow/}"
TIKPAL_KIOSK_WINDOW="${TIKPAL_KIOSK_WINDOW:-2560x720}"
TIKPAL_KIOSK_DISPLAY="${TIKPAL_KIOSK_DISPLAY:-:0}"
TIKPAL_CHROMIUM_BIN="${TIKPAL_CHROMIUM_BIN:-/usr/lib/chromium-browser/chromium-browser}"
TIKPAL_CHROMIUM_PROFILE_DIR="${TIKPAL_CHROMIUM_PROFILE_DIR:-/home/moode/.config/tikpal-chromium-kiosk}"
TIKPAL_CHROMIUM_FLAGS_FILE="${TIKPAL_CHROMIUM_FLAGS_FILE:-$APP_DIR/deploy/chromium/chromium-flags.conf}"
TIKPAL_CHROMIUM_POLICY_DIR="${TIKPAL_CHROMIUM_POLICY_DIR:-/etc/chromium/policies/managed}"
TIKPAL_CHROMIUM_POLICY_BASENAME="${TIKPAL_CHROMIUM_POLICY_BASENAME:-tikpal-kiosk-managed.json}"
TIKPAL_KIOSK_LOG_DIR="${TIKPAL_KIOSK_LOG_DIR:-$APP_DIR/.tikpal/kiosk}"
TIKPAL_KIOSK_ALLOW_REMOTE_DEBUG="${TIKPAL_KIOSK_ALLOW_REMOTE_DEBUG:-0}"

POLICY_FILE="$TIKPAL_CHROMIUM_POLICY_DIR/$TIKPAL_CHROMIUM_POLICY_BASENAME"
PID_FILE="$TIKPAL_KIOSK_LOG_DIR/chromium.pid"
LOG_FILE="$TIKPAL_KIOSK_LOG_DIR/chromium.log"
POLICY_SOURCE="$APP_DIR/deploy/chromium/managed-policies.json"
PREFERENCES_FILE="$TIKPAL_CHROMIUM_PROFILE_DIR/Default/Preferences"
LOCAL_STATE_FILE="$TIKPAL_CHROMIUM_PROFILE_DIR/Local State"

log() {
  mkdir -p "$TIKPAL_KIOSK_LOG_DIR"
  printf "[%s] %s\n" "$(date +"%Y-%m-%d %H:%M:%S")" "$*" >> "$LOG_FILE"
}

fail() {
  local message="$1"
  log "ERROR: $message"
  echo "tikpal-kiosk: $message" >&2
  exit 1
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf "%s" "$value"
}

validate_window() {
  if [[ ! "$TIKPAL_KIOSK_WINDOW" =~ ^[0-9]+x[0-9]+$ ]]; then
    fail "invalid TIKPAL_KIOSK_WINDOW '$TIKPAL_KIOSK_WINDOW' (expected WIDTHxHEIGHT)"
  fi
}

ensure_prerequisites() {
  [[ -x "$TIKPAL_CHROMIUM_BIN" ]] || fail "Chromium binary not found or not executable: $TIKPAL_CHROMIUM_BIN"
  [[ -n "$TIKPAL_KIOSK_DISPLAY" ]] || fail "TIKPAL_KIOSK_DISPLAY is empty"
  [[ -f "$TIKPAL_CHROMIUM_FLAGS_FILE" ]] || fail "flags file not found: $TIKPAL_CHROMIUM_FLAGS_FILE"
  [[ -f "$POLICY_FILE" ]] || fail "managed policy file not found: $POLICY_FILE"
  [[ -f "$POLICY_SOURCE" ]] || fail "managed policy source not found: $POLICY_SOURCE"
  validate_window
}

clean_profile() {
  mkdir -p "$TIKPAL_CHROMIUM_PROFILE_DIR/Default"
  rm -f \
    "$TIKPAL_CHROMIUM_PROFILE_DIR/SingletonCookie" \
    "$TIKPAL_CHROMIUM_PROFILE_DIR/SingletonLock" \
    "$TIKPAL_CHROMIUM_PROFILE_DIR/SingletonSocket" \
    "$TIKPAL_CHROMIUM_PROFILE_DIR/Default/Current Session" \
    "$TIKPAL_CHROMIUM_PROFILE_DIR/Default/Current Tabs" \
    "$TIKPAL_CHROMIUM_PROFILE_DIR/Default/Last Session" \
    "$TIKPAL_CHROMIUM_PROFILE_DIR/Default/Last Tabs"
  touch "$TIKPAL_CHROMIUM_PROFILE_DIR/First Run"

  TIKPAL_CHROMIUM_PROFILE_DIR="$TIKPAL_CHROMIUM_PROFILE_DIR" python3 - <<'PY'
import json
import os
from pathlib import Path

profile_dir = Path(os.environ["TIKPAL_CHROMIUM_PROFILE_DIR"])
targets = [
    profile_dir / "Default" / "Preferences",
    profile_dir / "Local State",
]

for path in targets:
    if path.exists():
        try:
            data = json.loads(path.read_text())
        except Exception:
            data = {}
    else:
        data = {}

    profile = data.setdefault("profile", {})
    profile["exit_type"] = "Normal"
    profile["exited_cleanly"] = True

    session = data.setdefault("session", {})
    if session.get("restore_on_startup") not in (4, "4"):
        session["restore_on_startup"] = 4

    browser = data.setdefault("browser", {})
    browser["has_seen_welcome_page"] = True

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":")))
PY
}

build_args() {
  local line stripped
  local -n out_ref=$1
  out_ref=()

  while IFS= read -r line || [[ -n "$line" ]]; do
    stripped="$(trim "${line%%#*}")"
    [[ -n "$stripped" ]] || continue

    case "$stripped" in
      --window-size=*|--window-position=*|--user-data-dir=*|--app=*|--app-id=*|--restore-last-session|--restore-last-session=* )
        continue
        ;;
      --remote-debugging-port=*|--remote-debugging-pipe)
        if [[ "$TIKPAL_KIOSK_ALLOW_REMOTE_DEBUG" != "1" ]]; then
          continue
        fi
        ;;
    esac

    out_ref+=("$stripped")
  done < "$TIKPAL_CHROMIUM_FLAGS_FILE"

  out_ref+=(
    "--user-data-dir=$TIKPAL_CHROMIUM_PROFILE_DIR"
    "--window-size=${TIKPAL_KIOSK_WINDOW/x/,}"
    "--window-position=0,0"
    "$TIKPAL_KIOSK_URL"
  )
}

terminate_existing_instance() {
  local pid=""
  if [[ -f "$PID_FILE" ]]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  fi

  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
  fi
}

main() {
  ensure_prerequisites
  mkdir -p "$TIKPAL_KIOSK_LOG_DIR" "$TIKPAL_CHROMIUM_PROFILE_DIR"

  export DISPLAY="$TIKPAL_KIOSK_DISPLAY"

  local -a chromium_args=()
  build_args chromium_args

  if [[ "$MODE" == "check" ]]; then
    echo "diagnostic: pass"
    echo "chromium_bin=$TIKPAL_CHROMIUM_BIN"
    echo "display=$DISPLAY"
    echo "profile_dir=$TIKPAL_CHROMIUM_PROFILE_DIR"
    echo "flags_file=$TIKPAL_CHROMIUM_FLAGS_FILE"
    echo "policy_file=$POLICY_FILE"
    echo "url=$TIKPAL_KIOSK_URL"
    return 0
  fi

  terminate_existing_instance
  clean_profile

  log "Launching Chromium kiosk for $TIKPAL_KIOSK_URL"
  "$TIKPAL_CHROMIUM_BIN" "${chromium_args[@]}" >> "$LOG_FILE" 2>&1 &
  local child_pid=$!
  echo "$child_pid" > "$PID_FILE"

  trap 'kill "$child_pid" 2>/dev/null || true' TERM INT
  wait "$child_pid"
}

main "$@"
