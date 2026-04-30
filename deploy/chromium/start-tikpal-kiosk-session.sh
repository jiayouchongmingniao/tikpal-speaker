#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TIKPAL_KIOSK_DISPLAY="${TIKPAL_KIOSK_DISPLAY:-:0}"
TIKPAL_KIOSK_XRANDR_MODE="${TIKPAL_KIOSK_XRANDR_MODE:-2560x720}"
TIKPAL_KIOSK_XRANDR_RATE="${TIKPAL_KIOSK_XRANDR_RATE:-}"
TIKPAL_KIOSK_XRANDR_OUTPUT="${TIKPAL_KIOSK_XRANDR_OUTPUT:-auto}"

export DISPLAY="$TIKPAL_KIOSK_DISPLAY"

if command -v xset >/dev/null 2>&1; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

if command -v xsetroot >/dev/null 2>&1; then
  xsetroot -solid black || true
fi

if command -v xrandr >/dev/null 2>&1 && [[ -n "$TIKPAL_KIOSK_XRANDR_MODE" ]]; then
  xrandr_output="$TIKPAL_KIOSK_XRANDR_OUTPUT"
  if [[ "$xrandr_output" == "auto" ]]; then
    xrandr_output="$(xrandr --query | awk '/ connected/{print $1; exit}')"
  fi

  if [[ -n "$xrandr_output" ]]; then
    if [[ -n "$TIKPAL_KIOSK_XRANDR_RATE" ]]; then
      xrandr --output "$xrandr_output" --mode "$TIKPAL_KIOSK_XRANDR_MODE" --rate "$TIKPAL_KIOSK_XRANDR_RATE" || true
    else
      xrandr --output "$xrandr_output" --mode "$TIKPAL_KIOSK_XRANDR_MODE" || true
    fi
  fi
fi

if command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 0.5 -root >/dev/null 2>&1 &
fi

sleep 1
exec /usr/bin/env bash "$APP_DIR/deploy/chromium/launch-tikpal-kiosk.sh"
