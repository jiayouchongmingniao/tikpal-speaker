#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/moode/code/tikpal-speaker}"
SERVICE_USER="${SERVICE_USER:-moode}"
SERVICE_GROUP="${SERVICE_GROUP:-$SERVICE_USER}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="install"

usage() {
  cat <<USAGE
Usage: $0 [--install|--dry-run|--verify]

Environment:
  APP_DIR        Target checkout path (default: /home/moode/code/tikpal-speaker)
  SERVICE_USER   systemd service user (default: moode)
  SERVICE_GROUP  systemd service group (default: SERVICE_USER)
  SYSTEMD_DIR    systemd unit output dir (default: /etc/systemd/system)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install)
      MODE="install"
      ;;
    --dry-run)
      MODE="dry-run"
      ;;
    --verify)
      MODE="verify"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

render_unit() {
  local template_path="$1"
  local output_path="$2"

  sed \
    -e "s|@APP_DIR@|${APP_DIR}|g" \
    -e "s|@SERVICE_USER@|${SERVICE_USER}|g" \
    -e "s|@SERVICE_GROUP@|${SERVICE_GROUP}|g" \
    "$template_path" > "$output_path"
}

render_unit_to_stdout() {
  local template_path="$1"

  sed \
    -e "s|@APP_DIR@|${APP_DIR}|g" \
    -e "s|@SERVICE_USER@|${SERVICE_USER}|g" \
    -e "s|@SERVICE_GROUP@|${SERVICE_GROUP}|g" \
    "$template_path"
}

check_path() {
  local label="$1"
  local path_value="$2"
  if [[ -e "$path_value" ]]; then
    echo "ok: $label $path_value"
  else
    echo "missing: $label $path_value"
    return 1
  fi
}

verify_environment() {
  local failures=0

  check_path "APP_DIR" "$APP_DIR" || failures=$((failures + 1))
  check_path "package.json" "$APP_DIR/package.json" || failures=$((failures + 1))
  check_path "server entry" "$APP_DIR/server/index.js" || failures=$((failures + 1))
  check_path "dist" "$APP_DIR/dist" || failures=$((failures + 1))

  if command -v node >/dev/null 2>&1; then
    echo "ok: node $(node --version)"
  else
    echo "missing: node"
    failures=$((failures + 1))
  fi

  if command -v npm >/dev/null 2>&1; then
    echo "ok: npm $(npm --version)"
  else
    echo "missing: npm"
    failures=$((failures + 1))
  fi

  if command -v systemctl >/dev/null 2>&1; then
    echo "ok: systemctl available"
    systemctl --no-pager --full status tikpal-api.service tikpal-web.service >/dev/null 2>&1 || true
  else
    echo "missing: systemctl"
    failures=$((failures + 1))
  fi

  return "$failures"
}

if [[ "$MODE" == "dry-run" ]]; then
  echo "# tikpal-api.service"
  render_unit_to_stdout "$SCRIPT_DIR/tikpal-api.service"
  echo
  echo "# tikpal-web.service"
  render_unit_to_stdout "$SCRIPT_DIR/tikpal-web.service"
  exit 0
fi

if [[ "$MODE" == "verify" ]]; then
  if verify_environment; then
    echo "diagnostic: pass"
  else
    echo "diagnostic: failed"
  fi
  exit 0
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "APP_DIR does not exist: $APP_DIR" >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl not found" >&2
  exit 1
fi

render_unit "$SCRIPT_DIR/tikpal-api.service" "$SYSTEMD_DIR/tikpal-api.service"
render_unit "$SCRIPT_DIR/tikpal-web.service" "$SYSTEMD_DIR/tikpal-web.service"

systemctl daemon-reload
systemctl enable tikpal-api.service tikpal-web.service
systemctl restart tikpal-api.service tikpal-web.service

systemctl --no-pager --full status tikpal-api.service tikpal-web.service
