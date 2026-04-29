export const BLANK_TAP_SHOW_OVERLAY = "show-overlay";
export const BLANK_TAP_HIDE_OVERLAY = "hide-overlay";
export const RETURN_OVERVIEW = "return-overview";
export const NEXT_MODE = "next_mode";
export const PREV_MODE = "prev_mode";
export const NEXT_FLOW_STATE = "next-flow-state";

const SAFARI_PINCH_RETURN_SCALE = 0.97;
const CHROME_PINCH_RETURN_DELTA = 60;
const SINGLE_TOUCH_SWIPE_DELTA = 72;
const SINGLE_TOUCH_SWIPE_AXIS_RATIO = 1.2;
const DOUBLE_TOUCH_SWIPE_DELTA = 84;
const DOUBLE_TOUCH_SWIPE_AXIS_RATIO = 1.25;
const DOUBLE_TOUCH_PINCH_RATIO_EPSILON = 0.12;

export function getBlankTapOverlayAction({ isFocusMode, overlayVisible, transitionStatus }) {
  if (!isFocusMode || transitionStatus !== "idle") {
    return null;
  }

  return overlayVisible ? BLANK_TAP_HIDE_OVERLAY : BLANK_TAP_SHOW_OVERLAY;
}

export function shouldHandleSingleTouchTap({ didTap = false, isInteractiveStart = false }) {
  return Boolean(didTap && !isInteractiveStart);
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

export function getSingleTouchSwipeIntent({
  activeMode,
  transitionStatus,
  isInteractiveStart = false,
  deltaX = 0,
  deltaY = 0,
}) {
  if (activeMode === "overview" || transitionStatus !== "idle" || isInteractiveStart) {
    return null;
  }

  const horizontalDelta = Number(deltaX ?? 0);
  const verticalDelta = Number(deltaY ?? 0);
  const absHorizontal = Math.abs(horizontalDelta);
  const absVertical = Math.abs(verticalDelta);

  if (absHorizontal < SINGLE_TOUCH_SWIPE_DELTA) {
    return null;
  }

  if (absHorizontal <= absVertical * SINGLE_TOUCH_SWIPE_AXIS_RATIO) {
    return null;
  }

  return horizontalDelta < 0 ? NEXT_MODE : PREV_MODE;
}

export function getDoubleTouchFlowSwipeIntent({
  activeMode,
  transitionStatus,
  isInteractiveStart = false,
  deltaX = 0,
  deltaY = 0,
  startDistance = 0,
  nextDistance = 0,
}) {
  if (activeMode !== "flow" || transitionStatus !== "idle" || isInteractiveStart) {
    return null;
  }

  const verticalDelta = Number(deltaY ?? 0);
  const horizontalDelta = Number(deltaX ?? 0);
  const absVertical = Math.abs(verticalDelta);
  const absHorizontal = Math.abs(horizontalDelta);

  if (verticalDelta < DOUBLE_TOUCH_SWIPE_DELTA) {
    return null;
  }

  if (absVertical <= absHorizontal * DOUBLE_TOUCH_SWIPE_AXIS_RATIO) {
    return null;
  }

  const normalizedStartDistance = Number(startDistance ?? 0);
  const normalizedNextDistance = Number(nextDistance ?? 0);
  if (normalizedStartDistance > 0 && normalizedNextDistance > 0) {
    const distanceRatio = normalizedNextDistance / normalizedStartDistance;
    if (Math.abs(distanceRatio - 1) > DOUBLE_TOUCH_PINCH_RATIO_EPSILON) {
      return null;
    }
  }

  return NEXT_FLOW_STATE;
}
