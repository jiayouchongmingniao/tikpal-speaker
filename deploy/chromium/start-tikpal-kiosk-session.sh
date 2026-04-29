#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TIKPAL_KIOSK_DISPLAY="${TIKPAL_KIOSK_DISPLAY:-:0}"

export DISPLAY="$TIKPAL_KIOSK_DISPLAY"

if command -v xset >/dev/null 2>&1; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

if command -v xsetroot >/dev/null 2>&1; then
  xsetroot -solid black || true
fi

if command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 0.5 -root >/dev/null 2>&1 &
fi

sleep 1
exec /usr/bin/env bash "$APP_DIR/deploy/chromium/launch-tikpal-kiosk.sh"
