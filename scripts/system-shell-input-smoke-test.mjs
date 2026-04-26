import assert from "node:assert/strict";
import {
  BLANK_TAP_HIDE_OVERLAY,
  BLANK_TAP_SHOW_OVERLAY,
  getBlankTapOverlayAction,
  getChromeTrackpadPinchIntent,
  getSafariGesturePinchIntent,
  RETURN_OVERVIEW,
} from "../src/interactions/systemShellInput.js";
import { getInitialModeFromLocation, getSurfaceFromLocation } from "../src/routing.js";

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("four normal entrances resolve to main shell modes", () => {
  assert.equal(getSurfaceFromLocation({ pathname: "/overview/", search: "" }), "main");
  assert.equal(getSurfaceFromLocation({ pathname: "/listen/", search: "" }), "main");
  assert.equal(getSurfaceFromLocation({ pathname: "/flow/", search: "" }), "main");
  assert.equal(getSurfaceFromLocation({ pathname: "/screen/", search: "" }), "main");
  assert.equal(getInitialModeFromLocation({ pathname: "/overview/", search: "" }), "overview");
  assert.equal(getInitialModeFromLocation({ pathname: "/listen/", search: "" }), "listen");
  assert.equal(getInitialModeFromLocation({ pathname: "/flow/", search: "" }), "flow");
  assert.equal(getInitialModeFromLocation({ pathname: "/screen/", search: "" }), "screen");
});

test("debug and portable routes keep priority over normal mode parsing", () => {
  assert.equal(getSurfaceFromLocation({ pathname: "/debug/", search: "" }), "debug");
  assert.equal(getSurfaceFromLocation({ pathname: "/flow/debug", search: "" }), "debug");
  assert.equal(getSurfaceFromLocation({ pathname: "/", search: "?surface=debug" }), "debug");
  assert.equal(getSurfaceFromLocation({ pathname: "/portable/", search: "" }), "portable");
  assert.equal(getSurfaceFromLocation({ pathname: "/", search: "?surface=portable" }), "portable");
});

test("blank tap toggles focus overlay without acting during overview or transitions", () => {
  assert.equal(
    getBlankTapOverlayAction({ isFocusMode: true, overlayVisible: false, transitionStatus: "idle" }),
    BLANK_TAP_SHOW_OVERLAY,
  );
  assert.equal(
    getBlankTapOverlayAction({ isFocusMode: true, overlayVisible: true, transitionStatus: "idle" }),
    BLANK_TAP_HIDE_OVERLAY,
  );
  assert.equal(getBlankTapOverlayAction({ isFocusMode: false, overlayVisible: false, transitionStatus: "idle" }), null);
  assert.equal(
    getBlankTapOverlayAction({ isFocusMode: true, overlayVisible: false, transitionStatus: "animating" }),
    null,
  );
});

test("Chrome ctrl wheel pinch returns from focus mode after either delta direction crosses threshold", () => {
  const positiveStart = getChromeTrackpadPinchIntent({ activeMode: "flow", accumulatedDeltaY: 0, deltaY: 32 });
  assert.equal(positiveStart.intent, null);
  assert.equal(positiveStart.preventDefault, true);

  const positiveEnd = getChromeTrackpadPinchIntent({
    activeMode: "flow",
    accumulatedDeltaY: positiveStart.nextDeltaY,
    deltaY: 34,
  });
  assert.equal(positiveEnd.intent, RETURN_OVERVIEW);
  assert.equal(positiveEnd.preventDefault, true);

  const negativeEnd = getChromeTrackpadPinchIntent({ activeMode: "screen", accumulatedDeltaY: -36, deltaY: -28 });
  assert.equal(negativeEnd.intent, RETURN_OVERVIEW);
});

test("Chrome pinch is consumed but does not return when already in overview", () => {
  const overviewIntent = getChromeTrackpadPinchIntent({ activeMode: "overview", accumulatedDeltaY: 0, deltaY: 80 });
  assert.equal(overviewIntent.intent, null);
  assert.equal(overviewIntent.preventDefault, true);
});

test("Safari gesture pinch keeps the shrink path and ignores pinch-out", () => {
  assert.equal(getSafariGesturePinchIntent({ activeMode: "listen", scale: 0.94 }), RETURN_OVERVIEW);
  assert.equal(getSafariGesturePinchIntent({ activeMode: "listen", scale: 1.04 }), null);
  assert.equal(getSafariGesturePinchIntent({ activeMode: "overview", scale: 0.94 }), null);
});

console.log("SystemShell input smoke tests passed.");
