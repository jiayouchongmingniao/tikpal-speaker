#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/moode/code/tikpal-speaker}"
SERVICE_USER="${SERVICE_USER:-moode}"
SERVICE_GROUP="${SERVICE_GROUP:-$SERVICE_USER}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
CHROMIUM_POLICY_DIR="${CHROMIUM_POLICY_DIR:-/etc/chromium/policies/managed}"
CHROMIUM_POLICY_BASENAME="${CHROMIUM_POLICY_BASENAME:-tikpal-kiosk-managed.json}"
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
  CHROMIUM_POLICY_DIR       Managed Chromium policy dir (default: /etc/chromium/policies/managed)
  CHROMIUM_POLICY_BASENAME  Managed Chromium policy filename (default: tikpal-kiosk-managed.json)
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
  local chromium_bin="/usr/lib/chromium-browser/chromium-browser"
  local kiosk_display=":0"
  local kiosk_profile_dir="/home/moode/.config/tikpal-chromium-kiosk"
  local kiosk_flags_file="$APP_DIR/deploy/chromium/chromium-flags.conf"
  local kiosk_policy_file="$CHROMIUM_POLICY_DIR/$CHROMIUM_POLICY_BASENAME"

  if [[ -f "$APP_DIR/.env.kiosk" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$APP_DIR/.env.kiosk"
    set +a
    chromium_bin="${TIKPAL_CHROMIUM_BIN:-$chromium_bin}"
    kiosk_display="${TIKPAL_KIOSK_DISPLAY:-$kiosk_display}"
    kiosk_profile_dir="${TIKPAL_CHROMIUM_PROFILE_DIR:-$kiosk_profile_dir}"
    kiosk_flags_file="${TIKPAL_CHROMIUM_FLAGS_FILE:-$kiosk_flags_file}"
    kiosk_policy_file="${TIKPAL_CHROMIUM_POLICY_DIR:-$CHROMIUM_POLICY_DIR}/${TIKPAL_CHROMIUM_POLICY_BASENAME:-$CHROMIUM_POLICY_BASENAME}"
  fi

  check_path "APP_DIR" "$APP_DIR" || failures=$((failures + 1))
  check_path "package.json" "$APP_DIR/package.json" || failures=$((failures + 1))
  check_path "server entry" "$APP_DIR/server/index.js" || failures=$((failures + 1))
  check_path "dist" "$APP_DIR/dist" || failures=$((failures + 1))
  check_path "kiosk launcher" "$APP_DIR/deploy/chromium/launch-tikpal-kiosk.sh" || failures=$((failures + 1))
  check_path "kiosk flags" "$kiosk_flags_file" || failures=$((failures + 1))
  check_path "kiosk policy source" "$APP_DIR/deploy/chromium/managed-policies.json" || failures=$((failures + 1))

  if [[ -x "$chromium_bin" ]]; then
    echo "ok: chromium $chromium_bin"
  else
    echo "missing: chromium $chromium_bin"
    failures=$((failures + 1))
  fi

  if [[ -n "$kiosk_display" ]]; then
    echo "ok: kiosk display $kiosk_display"
  else
    echo "missing: kiosk display"
    failures=$((failures + 1))
  fi

  if [[ -d "$kiosk_profile_dir" ]]; then
    echo "ok: kiosk profile dir $kiosk_profile_dir"
  else
    echo "diagnostic: kiosk profile dir will be created at $kiosk_profile_dir"
  fi

  if [[ -f "$kiosk_policy_file" ]]; then
    echo "ok: kiosk policy file $kiosk_policy_file"
  else
    echo "missing: kiosk policy file $kiosk_policy_file"
    failures=$((failures + 1))
  fi

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
  echo
  echo "# tikpal-kiosk.service"
  render_unit_to_stdout "$SCRIPT_DIR/tikpal-kiosk.service"
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
render_unit "$SCRIPT_DIR/tikpal-kiosk.service" "$SYSTEMD_DIR/tikpal-kiosk.service"

mkdir -p "$CHROMIUM_POLICY_DIR"
install -m 0644 "$APP_DIR/deploy/chromium/managed-policies.json" "$CHROMIUM_POLICY_DIR/$CHROMIUM_POLICY_BASENAME"

systemctl daemon-reload
systemctl enable tikpal-api.service tikpal-web.service tikpal-kiosk.service
systemctl restart tikpal-api.service tikpal-web.service tikpal-kiosk.service

systemctl --no-pager --full status tikpal-api.service tikpal-web.service tikpal-kiosk.service
