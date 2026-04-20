#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/moode/code/tikpal-speaker}"
SERVICE_USER="${SERVICE_USER:-moode}"
SERVICE_GROUP="${SERVICE_GROUP:-$SERVICE_USER}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

render_unit() {
  local template_path="$1"
  local output_path="$2"

  sed \
    -e "s|@APP_DIR@|${APP_DIR}|g" \
    -e "s|@SERVICE_USER@|${SERVICE_USER}|g" \
    -e "s|@SERVICE_GROUP@|${SERVICE_GROUP}|g" \
    "$template_path" > "$output_path"
}

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
