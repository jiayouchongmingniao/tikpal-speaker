export const BLANK_TAP_SHOW_OVERLAY = "show-overlay";
export const BLANK_TAP_HIDE_OVERLAY = "hide-overlay";
export const RETURN_OVERVIEW = "return-overview";

const SAFARI_PINCH_RETURN_SCALE = 0.97;
const CHROME_PINCH_RETURN_DELTA = 60;

export function getBlankTapOverlayAction({ isFocusMode, overlayVisible, transitionStatus }) {
  if (!isFocusMode || transitionStatus !== "idle") {
    return null;
  }

  return overlayVisible ? BLANK_TAP_HIDE_OVERLAY : BLANK_TAP_SHOW_OVERLAY;
}

export function getChromeTrackpadPinchIntent({ activeMode, accumulatedDeltaY = 0, deltaY = 0 }) {
  const nextDeltaY = accumulatedDeltaY + Number(deltaY ?? 0);

  return {
    intent: activeMode !== "overview" && Math.abs(nextDeltaY) >= CHROME_PINCH_RETURN_DELTA ? RETURN_OVERVIEW : null,
    nextDeltaY,
    preventDefault: true,
  };
}

export function getSafariGesturePinchIntent({ activeMode, scale = 1 }) {
  const normalizedScale = Number(scale ?? 1);
  if (activeMode !== "overview" && normalizedScale < SAFARI_PINCH_RETURN_SCALE) {
    return RETURN_OVERVIEW;
  }

  return null;
}
