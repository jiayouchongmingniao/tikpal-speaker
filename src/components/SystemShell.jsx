import { useEffect, useRef, useState } from "react";
import { FlowModePage } from "./FlowModePage";
import { GlobalOverlay } from "./GlobalOverlay";
import { ListenPage } from "./ListenPage";
import { OverviewPage } from "./OverviewPage";
import { ScreenPage } from "./ScreenPage";
import { usePerformanceTelemetry } from "../hooks/usePerformanceTelemetry";
import { useSystemController } from "../hooks/useSystemController";
import {
  BLANK_TAP_HIDE_OVERLAY,
  BLANK_TAP_SHOW_OVERLAY,
  getBlankTapOverlayAction,
  getChromeTrackpadPinchIntent,
  getSafariGesturePinchIntent,
  RETURN_OVERVIEW,
} from "../interactions/systemShellInput";
import { FONT_PRESETS } from "../typography";
import { getOtaStatusHint } from "../viewmodels/screenContextConsumers";

const OVERVIEW_MODES = ["listen", "flow", "screen"];
const OVERLAY_HIDE_MS = 10000;

function getModeSlotClass(mode) {
  if (mode === "listen") {
    return "page-layer--slot-left";
  }

  if (mode === "screen") {
    return "page-layer--slot-right";
  }

  return "page-layer--slot-center";
}

function getPageLayerClass(pageMode, activeMode, transition) {
  const from = transition?.from ?? activeMode;
  const to = transition?.to ?? activeMode;
  const status = transition?.status ?? "idle";
  const isOverviewPage = pageMode === "overview";
  const pageKey = isOverviewPage ? "overview" : pageMode;
  const activeKey = activeMode === "overview" ? "overview" : activeMode;

  if (status === "idle") {
    return activeKey === pageKey ? "page-layer is-active" : "page-layer is-hidden";
  }

  if (from === pageKey) {
    if (to === "overview" && !isOverviewPage) {
      return `page-layer is-exiting page-layer--focus-exit ${getModeSlotClass(pageKey)}`;
    }

    if (to !== "overview" && from !== "overview" && !isOverviewPage) {
      return "page-layer is-exiting page-layer--handoff-out";
    }

    return "page-layer is-exiting";
  }

  if (to === pageKey) {
    if (from === "overview" && !isOverviewPage) {
      return `page-layer is-entering page-layer--focus-enter ${getModeSlotClass(pageKey)}`;
    }

    if (from !== "overview" && to !== "overview" && !isOverviewPage) {
      return "page-layer is-entering page-layer--handoff-in";
    }

    return "page-layer is-entering";
  }

  if (activeKey === pageKey) {
    return "page-layer is-active";
  }

  return "page-layer is-hidden";
}

function isInteractiveTarget(target) {
  return (
    target instanceof Element &&
    Boolean(target.closest("button, input, select, textarea, label, a, [role='button'], [data-overlay-action], [data-shell-settings]"))
  );
}

function isShellSettingsTarget(target) {
  return target instanceof Element && Boolean(target.closest("[data-shell-settings]"));
}

function getOverlayActions(container) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll("[data-overlay-action]")).filter(
    (element) => !element.disabled && element.getAttribute("aria-hidden") !== "true",
  );
}

function getGestureDirection(delta) {
  return delta > 0 ? "right" : "left";
}

export function SystemShell({
  initialMode = "overview",
  initialFlowState = "focus",
  debug = false,
  fontPresetId,
  onFontPresetChange,
}) {
  const controller = useSystemController({ initialMode, initialFlowState });
  const { state, screenContext } = controller;
  const renderProfile = state.system?.renderProfile ?? "off";
  const overlayRef = useRef(null);
  const overlayTimerRef = useRef(null);
  const pointerTapRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    moved: false,
    interactive: false,
  });
  const singleTouchTapRef = useRef({
    active: false,
    identifier: null,
    startX: 0,
    startY: 0,
    moved: false,
  });
  const trackpadGestureRef = useRef({
    pinch: 0,
    horizontal: 0,
    vertical: 0,
    cleanupTimer: null,
  });
  const [overviewFocusIndex, setOverviewFocusIndex] = useState(0);
  const [overlayFocusIndex, setOverlayFocusIndex] = useState(0);
  const [inputDebug, setInputDebug] = useState("idle");
  const [fontPanelOpen, setFontPanelOpen] = useState(false);
  const [powerPanelOpen, setPowerPanelOpen] = useState(false);
  const [pendingPowerAction, setPendingPowerAction] = useState("");
  const [powerNotice, setPowerNotice] = useState("");
  const [powerError, setPowerError] = useState("");
  const [powerBusy, setPowerBusy] = useState(false);
  const transitionStatus = state.transition?.status ?? "idle";
  const transition = state.transition ?? { status: "idle", from: state.activeMode, to: state.activeMode };
  const isFocusMode = state.activeMode !== "overview";
  const shouldRenderOverview =
    state.activeMode === "overview" || transition.from === "overview" || transition.to === "overview";
  const shouldRenderListen =
    state.activeMode === "listen" || transition.from === "listen" || transition.to === "listen";
  const shouldRenderFlow =
    state.activeMode === "flow" || transition.from === "flow" || transition.to === "flow";
  const shouldRenderScreen =
    state.activeMode === "screen" || transition.from === "screen" || transition.to === "screen";
  const overviewFocusTarget =
    transitionStatus !== "idle"
      ? transition.to === "overview"
        ? transition.from
        : transition.from === "overview"
          ? transition.to
          : null
      : null;
  const otaStatusHint = getOtaStatusHint(state.system);

  usePerformanceTelemetry({
    activeMode: state.activeMode,
    reportPerformance: controller.reportPerformance,
  });

  function clearOverlayTimer() {
    if (overlayTimerRef.current) {
      window.clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }
  }

  function reportInputDebug(message) {
    if (!debug) {
      return;
    }

    try {
      const event = {
        at: new Date().toISOString(),
        mode: stateRef.current.activeMode,
        transition: stateRef.current.transition?.status ?? "idle",
        message,
      };
      const previous = JSON.parse(window.localStorage.getItem("tikpal-input-debug-events") ?? "[]");
      const next = [event, ...(Array.isArray(previous) ? previous : [])].slice(0, 24);
      window.localStorage.setItem("tikpal-input-debug-events", JSON.stringify(next));
    } catch {
      // Local storage is best-effort debug evidence only.
    }

    setInputDebug(message);
  }

  function resetTrackpadGesture() {
    const gesture = trackpadGestureRef.current;
    if (gesture.cleanupTimer) {
      window.clearTimeout(gesture.cleanupTimer);
    }
    gesture.pinch = 0;
    gesture.horizontal = 0;
    gesture.vertical = 0;
    gesture.cleanupTimer = null;
  }

  function scheduleTrackpadGestureReset() {
    const gesture = trackpadGestureRef.current;
    if (gesture.cleanupTimer) {
      window.clearTimeout(gesture.cleanupTimer);
    }
    gesture.cleanupTimer = window.setTimeout(() => {
      resetTrackpadGesture();
    }, 180);
  }

  function scheduleOverlayHide() {
    clearOverlayTimer();
    overlayTimerRef.current = window.setTimeout(() => {
      controller.hideControls();
    }, OVERLAY_HIDE_MS);
  }

  function revealOverlay(reason = "user") {
    if (!isFocusMode || transitionStatus !== "idle") {
      return;
    }

    controller.showControls(reason);
    scheduleOverlayHide();
  }

  function handleBlankTap() {
    const action = getBlankTapOverlayAction({
      isFocusMode,
      overlayVisible: state.overlay.visible,
      transitionStatus,
    });

    if (action === BLANK_TAP_HIDE_OVERLAY) {
      reportInputDebug("blank tap hide overlay");
      clearOverlayTimer();
      controller.hideControls();
      return;
    }

    if (action === BLANK_TAP_SHOW_OVERLAY) {
      revealOverlay("blank-tap");
    }
  }

  function closeShellPanels() {
    setFontPanelOpen(false);
    setPowerPanelOpen(false);
    setPendingPowerAction("");
  }

  async function handlePowerAction(type) {
    if (!type) {
      return;
    }

    setPowerError("");
    setPowerNotice("");

    if (pendingPowerAction !== type) {
      setPendingPowerAction(type);
      return;
    }

    setPowerBusy(true);
    try {
      await controller.dispatch(type, {}, "speaker-ui-power");
      setPowerNotice(type === "system_reboot" ? "Restart requested. The UI may disconnect in a moment." : "Shutdown requested. The UI may disconnect in a moment.");
      setPendingPowerAction("");
      setPowerPanelOpen(false);
    } catch (error) {
      setPowerError(error instanceof Error ? error.message : String(error));
    } finally {
      setPowerBusy(false);
    }
  }

  useEffect(
    () => () => {
      clearOverlayTimer();
      resetTrackpadGesture();
    },
    [],
  );

  useEffect(() => {
    if (state.activeMode === "overview") {
      clearOverlayTimer();
      if (state.overlay.visible) {
        controller.hideControls();
      }
    }
  }, [state.activeMode, state.overlay.visible, transitionStatus]);

  useEffect(() => {
    if (!otaStatusHint || !isFocusMode || transitionStatus !== "idle") {
      return;
    }

    revealOverlay("system-status");
  }, [otaStatusHint, isFocusMode, transitionStatus]);

  useEffect(() => {
    const focusPanel = state.activeMode === "overview" ? state.focusedPanel : state.activeMode;
    const nextIndex = OVERVIEW_MODES.indexOf(focusPanel);
    if (nextIndex >= 0) {
      setOverviewFocusIndex(nextIndex);
    }
  }, [state.activeMode, state.focusedPanel]);

  useEffect(() => {
    if (!state.overlay.visible) {
      setOverlayFocusIndex(0);
      const actions = getOverlayActions(overlayRef.current);
      actions.forEach((action) => action.setAttribute("data-overlay-focused", "false"));
      return;
    }

    const actions = getOverlayActions(overlayRef.current);
    actions.forEach((action, index) => {
      action.setAttribute("data-overlay-focused", index === overlayFocusIndex ? "true" : "false");
    });
    const nextIndex = Math.min(overlayFocusIndex, Math.max(actions.length - 1, 0));
    const nextAction = actions[nextIndex];
    if (nextAction) {
      nextAction.focus();
    }
    scheduleOverlayHide();
  }, [overlayFocusIndex, state.overlay.visible, state.activeMode, state.playback.state, state.playback.volume, state.flow.state, state.screen.pomodoroState]);

  useEffect(() => {
    function onKeyDown(event) {
      if (transitionStatus !== "idle") {
        return;
      }

      if (event.key === "1") {
        controller.setMode("listen");
        return;
      }

      if (event.key === "2") {
        controller.setMode("flow");
        return;
      }

      if (event.key === "3") {
        controller.setMode("screen");
        return;
      }

      if (state.activeMode === "overview") {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          const nextIndex = (overviewFocusIndex - 1 + OVERVIEW_MODES.length) % OVERVIEW_MODES.length;
          controller.focusPanel(OVERVIEW_MODES[nextIndex]);
          return;
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          const nextIndex = (overviewFocusIndex + 1) % OVERVIEW_MODES.length;
          controller.focusPanel(OVERVIEW_MODES[nextIndex]);
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          controller.setMode(OVERVIEW_MODES[overviewFocusIndex]);
        }

        return;
      }

      if ((fontPanelOpen || powerPanelOpen) && event.key === "Escape") {
        event.preventDefault();
        closeShellPanels();
        return;
      }

      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        controller.returnOverview();
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        revealOverlay("remote");
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (!state.overlay.visible) {
          revealOverlay("remote");
          return;
        }

        const actions = getOverlayActions(overlayRef.current);
        actions[overlayFocusIndex]?.click();
        scheduleOverlayHide();
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();

        if (!state.overlay.visible) {
          if (event.key === "ArrowLeft") {
            controller.prevMode();
          } else {
            controller.nextMode();
          }
          return;
        }

        const actions = getOverlayActions(overlayRef.current);
        if (!actions.length) {
          return;
        }

        setOverlayFocusIndex((current) => {
          const step = event.key === "ArrowRight" ? 1 : -1;
          return (current + step + actions.length) % actions.length;
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller, fontPanelOpen, overviewFocusIndex, overlayFocusIndex, powerPanelOpen, state.activeMode, state.overlay.visible, transitionStatus]);

  useEffect(() => {
    function moveOverviewFocus(direction) {
      const step = direction === "right" ? 1 : -1;
      const nextIndex = (overviewFocusIndex + step + OVERVIEW_MODES.length) % OVERVIEW_MODES.length;
      controller.focusPanel(OVERVIEW_MODES[nextIndex]);
    }

    function moveOverlayFocus(direction) {
      const actions = getOverlayActions(overlayRef.current);
      if (!actions.length) {
        return false;
      }

      setOverlayFocusIndex((current) => {
        const step = direction === "right" ? 1 : -1;
        return (current + step + actions.length) % actions.length;
      });
      scheduleOverlayHide();
      return true;
    }

    function handleTrackpadHorizontal(delta) {
      const direction = getGestureDirection(delta);
      reportInputDebug(`trackpad horizontal ${direction} (${Math.round(delta)})`);

      if (state.activeMode === "overview") {
        moveOverviewFocus(direction);
        return;
      }

      if (state.overlay.visible && moveOverlayFocus(direction)) {
        return;
      }

      if (direction === "right") {
        controller.nextMode();
      } else {
        controller.prevMode();
      }
    }

    function handleTrackpadVertical() {
      if (state.activeMode !== "overview") {
        reportInputDebug("trackpad vertical overlay");
        revealOverlay("trackpad-scroll");
      }
    }

    function handleTrackpadPinch() {
      if (state.activeMode !== "overview") {
        reportInputDebug("trackpad pinch overview");
        controller.returnOverview();
      }
    }

    function onWheel(event) {
      if (transitionStatus !== "idle") {
        return;
      }

      if (isInteractiveTarget(event.target)) {
        return;
      }

      const looksLikeTrackpad =
        event.deltaMode === 0 ||
        event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ||
        (Math.abs(event.deltaX) > 0 && Math.abs(event.deltaX) < 120) ||
        (Math.abs(event.deltaY) > 0 && Math.abs(event.deltaY) < 120);
      if (!looksLikeTrackpad) {
        return;
      }

      const gesture = trackpadGestureRef.current;
      reportInputDebug(
        `wheel dx:${Math.round(event.deltaX)} dy:${Math.round(event.deltaY)} ctrl:${event.ctrlKey ? "1" : "0"}`,
      );

      if (event.ctrlKey) {
        event.preventDefault();
        const pinchIntent = getChromeTrackpadPinchIntent({
          activeMode: state.activeMode,
          accumulatedDeltaY: gesture.pinch,
          deltaY: event.deltaY,
        });
        gesture.pinch = pinchIntent.nextDeltaY;
        scheduleTrackpadGestureReset();

        if (pinchIntent.intent === RETURN_OVERVIEW) {
          resetTrackpadGesture();
          handleTrackpadPinch();
        }
        return;
      }

      gesture.horizontal += event.deltaX;
      gesture.vertical += event.deltaY;
      scheduleTrackpadGestureReset();

      if (Math.abs(gesture.horizontal) > 44 && Math.abs(gesture.horizontal) > Math.abs(gesture.vertical) * 1.1) {
        event.preventDefault();
        const horizontalDelta = gesture.horizontal;
        resetTrackpadGesture();
        handleTrackpadHorizontal(horizontalDelta);
        return;
      }

      if (Math.abs(gesture.vertical) > 32 && Math.abs(gesture.vertical) > Math.abs(gesture.horizontal) * 0.9) {
        if (state.activeMode !== "overview") {
          event.preventDefault();
          resetTrackpadGesture();
          handleTrackpadVertical();
        }
      }
    }

    function onGestureStart(event) {
      if (transitionStatus !== "idle" || isInteractiveTarget(event.target)) {
        return;
      }

      reportInputDebug(`gesturestart scale:${Number(event.scale ?? 1).toFixed(2)}`);
      event.preventDefault();
    }

    function onGestureChange(event) {
      if (transitionStatus !== "idle" || isInteractiveTarget(event.target)) {
        return;
      }

      event.preventDefault();
      reportInputDebug(`gesturechange scale:${Number(event.scale ?? 1).toFixed(2)}`);

      if (getSafariGesturePinchIntent({ activeMode: state.activeMode, scale: event.scale }) === RETURN_OVERVIEW) {
        handleTrackpadPinch();
      }
    }

    function onGestureEnd() {
      reportInputDebug("gestureend");
      resetTrackpadGesture();
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousewheel", onWheel, { passive: false });
    document.addEventListener("mousewheel", onWheel, { passive: false });
    window.addEventListener("gesturestart", onGestureStart, { passive: false });
    document.addEventListener("gesturestart", onGestureStart, { passive: false });
    window.addEventListener("gesturechange", onGestureChange, { passive: false });
    document.addEventListener("gesturechange", onGestureChange, { passive: false });
    window.addEventListener("gestureend", onGestureEnd);
    document.addEventListener("gestureend", onGestureEnd);

    return () => {
      window.removeEventListener("wheel", onWheel);
      document.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousewheel", onWheel);
      document.removeEventListener("mousewheel", onWheel);
      window.removeEventListener("gesturestart", onGestureStart);
      document.removeEventListener("gesturestart", onGestureStart);
      window.removeEventListener("gesturechange", onGestureChange);
      document.removeEventListener("gesturechange", onGestureChange);
      window.removeEventListener("gestureend", onGestureEnd);
      document.removeEventListener("gestureend", onGestureEnd);
    };
  }, [controller, debug, overlayFocusIndex, overviewFocusIndex, state.activeMode, state.overlay.visible, transitionStatus]);

  function onShellPointerDown(event) {
    if (fontPanelOpen || powerPanelOpen) {
      if (isShellSettingsTarget(event.target)) {
        return;
      }

      closeShellPanels();
      pointerTapRef.current.active = false;
      return;
    }

    if (event.pointerType === "touch") {
      return;
    }
    if (!isFocusMode) {
      return;
    }
    pointerTapRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      interactive: isInteractiveTarget(event.target),
    };
  }

  function onShellPointerMove(event) {
    if (fontPanelOpen || powerPanelOpen) {
      return;
    }

    if (event.pointerType === "touch") {
      return;
    }
    if (!pointerTapRef.current.active) {
      return;
    }

    const deltaX = event.clientX - pointerTapRef.current.startX;
    const deltaY = event.clientY - pointerTapRef.current.startY;
    if (Math.hypot(deltaX, deltaY) > 14) {
      pointerTapRef.current.moved = true;
    }
  }

  function onShellPointerUp(event) {
    if (fontPanelOpen || powerPanelOpen) {
      return;
    }

    if (event.pointerType === "touch") {
      return;
    }
    if (!pointerTapRef.current.active) {
      return;
    }

    const shouldHandleBlankTap = !pointerTapRef.current.interactive && !pointerTapRef.current.moved;
    pointerTapRef.current.active = false;
    if (shouldHandleBlankTap) {
      handleBlankTap();
    }
  }

  function onShellPointerCancel(event) {
    if (event.pointerType === "touch") {
      return;
    }
    pointerTapRef.current.active = false;
  }

  function onShellTouchStart(event) {
    if (fontPanelOpen || powerPanelOpen) {
      if (isShellSettingsTarget(event.target)) {
        return;
      }

      closeShellPanels();
      singleTouchTapRef.current.active = false;
      return;
    }

    if (state.activeMode === "overview") {
      return;
    }

    if (event.touches.length < 2) {
      const touch = event.touches[0];
      singleTouchTapRef.current = {
        active: !isInteractiveTarget(event.target),
        identifier: touch?.identifier ?? null,
        startX: touch?.clientX ?? 0,
        startY: touch?.clientY ?? 0,
        moved: false,
      };
      return;
    }

    singleTouchTapRef.current.active = false;

    const [firstTouch, secondTouch] = event.touches;
    const startDistance = Math.hypot(
      (secondTouch?.clientX ?? 0) - (firstTouch?.clientX ?? 0),
      (secondTouch?.clientY ?? 0) - (firstTouch?.clientY ?? 0),
    );

    if (!startDistance) {
      return;
    }

    let didReturnOverview = false;

    function onTouchMove(moveEvent) {
      if (moveEvent.touches.length < 2 || didReturnOverview) {
        return;
      }

      const [nextFirstTouch, nextSecondTouch] = moveEvent.touches;
      const nextDistance = Math.hypot(
        (nextSecondTouch?.clientX ?? 0) - (nextFirstTouch?.clientX ?? 0),
        (nextSecondTouch?.clientY ?? 0) - (nextFirstTouch?.clientY ?? 0),
      );

      if (nextDistance / startDistance < 0.82) {
        didReturnOverview = true;
        controller.returnOverview();
      }
    }

    function cleanupPinchTracking() {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", cleanupPinchTracking);
      window.removeEventListener("touchcancel", cleanupPinchTracking);
    }

    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", cleanupPinchTracking, { once: true });
    window.addEventListener("touchcancel", cleanupPinchTracking, { once: true });
  }

  function onShellTouchMove(event) {
    if (fontPanelOpen || powerPanelOpen) {
      return;
    }

    if (!singleTouchTapRef.current.active) {
      return;
    }

    const touch = Array.from(event.touches).find((item) => item.identifier === singleTouchTapRef.current.identifier);
    if (!touch) {
      singleTouchTapRef.current.active = false;
      return;
    }

    if (
      Math.hypot(touch.clientX - singleTouchTapRef.current.startX, touch.clientY - singleTouchTapRef.current.startY) > 14
    ) {
      singleTouchTapRef.current.moved = true;
    }
  }

  function onShellTouchEnd(event) {
    if (fontPanelOpen || powerPanelOpen) {
      return;
    }

    if (!singleTouchTapRef.current.active) {
      return;
    }

    const touch = Array.from(event.changedTouches).find((item) => item.identifier === singleTouchTapRef.current.identifier);
    const didTap = touch && !singleTouchTapRef.current.moved;
    singleTouchTapRef.current.active = false;
    if (didTap) {
      handleBlankTap();
    }
  }

  function onShellTouchCancel() {
    singleTouchTapRef.current.active = false;
  }

  return (
    <div
      className={`system-shell mode-${state.activeMode} transition-${transitionStatus} render-profile-${renderProfile}`}
      onPointerDown={onShellPointerDown}
      onPointerMove={onShellPointerMove}
      onPointerUp={onShellPointerUp}
      onPointerCancel={onShellPointerCancel}
      onTouchStart={onShellTouchStart}
      onTouchMove={onShellTouchMove}
      onTouchEnd={onShellTouchEnd}
      onTouchCancel={onShellTouchCancel}
    >
      <div className="shell-settings" data-shell-settings>
        <button
          type="button"
          className={`shell-button shell-button--ghost shell-settings__trigger ${fontPanelOpen ? "is-active" : ""}`}
          aria-expanded={fontPanelOpen}
          aria-controls="typography-panel"
          onClick={() => setFontPanelOpen((current) => !current)}
          onClickCapture={() => {
            setPowerPanelOpen(false);
            setPendingPowerAction("");
          }}
          data-shell-settings
        >
          Fonts
        </button>

        <section
          id="typography-panel"
          className={`shell-settings__panel ${fontPanelOpen ? "is-open" : ""}`}
          aria-hidden={!fontPanelOpen}
          data-shell-settings
        >
          <div className="shell-settings__header">
            <div>
              <span className="shell-settings__kicker">Typography</span>
              <h2>Choose your reading tone</h2>
            </div>
            <button
              type="button"
              className="shell-button shell-button--ghost"
              onClick={() => setFontPanelOpen(false)}
              data-shell-settings
            >
              Close
            </button>
          </div>

          <p className="shell-settings__intro">
            Apply a system-safe font across Listen, Flow, Screen, and the debug surface.
          </p>

          <div className="shell-settings__options" role="list" aria-label="Font presets">
            {FONT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`shell-settings__option ${fontPresetId === preset.id ? "is-selected" : ""}`}
                onClick={() => onFontPresetChange(preset.id)}
                style={{ fontFamily: preset.fontFamily }}
                data-shell-settings
              >
                <span className="shell-settings__option-header">
                  <strong>{preset.label}</strong>
                  <span>{fontPresetId === preset.id ? "Active" : "Apply"}</span>
                </span>
                <span className="shell-settings__option-preview">{preset.preview}</span>
                <span className="shell-settings__option-copy">{preset.description}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="shell-power" data-shell-settings>
        <button
          type="button"
          className={`shell-button shell-button--ghost shell-power__trigger ${powerPanelOpen ? "is-active" : ""}`}
          aria-expanded={powerPanelOpen}
          aria-controls="power-panel"
          onClick={() => {
            setFontPanelOpen(false);
            setPowerPanelOpen((current) => !current);
            setPendingPowerAction("");
            setPowerError("");
            setPowerNotice("");
          }}
          data-shell-settings
        >
          Power
        </button>

        <section
          id="power-panel"
          className={`shell-power__panel ${powerPanelOpen ? "is-open" : ""}`}
          aria-hidden={!powerPanelOpen}
          data-shell-settings
        >
          <div className="shell-settings__header">
            <div>
              <span className="shell-settings__kicker">System</span>
              <h2>Power controls</h2>
            </div>
            <button
              type="button"
              className="shell-button shell-button--ghost"
              onClick={() => {
                setPowerPanelOpen(false);
                setPendingPowerAction("");
              }}
              data-shell-settings
            >
              Close
            </button>
          </div>

          <p className="shell-settings__intro">
            Use a second tap to confirm. These actions affect the whole device.
          </p>

          <div className="shell-power__actions" data-shell-settings>
            <button
              type="button"
              className={`shell-power__action ${pendingPowerAction === "system_reboot" ? "is-confirming" : ""}`}
              onClick={() => handlePowerAction("system_reboot")}
              disabled={powerBusy}
              data-shell-settings
            >
              <strong>{pendingPowerAction === "system_reboot" ? "Confirm restart" : "Restart system"}</strong>
              <span>Reboot the Raspberry Pi and relaunch Tikpal on boot.</span>
            </button>
            <button
              type="button"
              className={`shell-power__action shell-power__action--danger ${pendingPowerAction === "system_shutdown" ? "is-confirming" : ""}`}
              onClick={() => handlePowerAction("system_shutdown")}
              disabled={powerBusy}
              data-shell-settings
            >
              <strong>{pendingPowerAction === "system_shutdown" ? "Confirm shutdown" : "Shut down system"}</strong>
              <span>Power off the device cleanly.</span>
            </button>
          </div>

          {powerNotice ? <p className="shell-power__message shell-power__message--notice">{powerNotice}</p> : null}
          {powerError ? <p className="shell-power__message shell-power__message--error">{powerError}</p> : null}
        </section>
      </div>

      {shouldRenderOverview ? (
        <OverviewPage
          className={getPageLayerClass("overview", state.activeMode, transition)}
          state={state}
          screenContext={screenContext}
          focusTarget={overviewFocusTarget}
          activeCard={OVERVIEW_MODES[overviewFocusIndex]}
          onOpenMode={controller.setMode}
          onPrevTrack={controller.prevTrack}
          onTogglePlay={controller.togglePlay}
          onNextTrack={controller.nextTrack}
          onSetFlowState={controller.setFlowState}
          onStartPomodoro={controller.startPomodoro}
          onResumePomodoro={controller.resumePomodoro}
          onPausePomodoro={controller.pausePomodoro}
          onResetPomodoro={controller.resetPomodoro}
          onCompleteTask={controller.completeCurrentTask}
        />
      ) : null}

      {shouldRenderListen ? (
        <ListenPage
          className={getPageLayerClass("listen", state.activeMode, transition)}
          state={state}
          onTogglePlay={controller.togglePlay}
          onPrevTrack={controller.prevTrack}
          onNextTrack={controller.nextTrack}
          onSetVolume={controller.setVolume}
        />
      ) : null}

      {shouldRenderFlow ? (
        <FlowModePage className={getPageLayerClass("flow", state.activeMode, transition)} systemState={state} />
      ) : null}

      {shouldRenderScreen ? (
        <ScreenPage
          className={getPageLayerClass("screen", state.activeMode, transition)}
          state={state}
          screenContext={screenContext}
          onOpenMode={controller.setMode}
          onReturnOverview={controller.returnOverview}
          onStartPomodoro={controller.startPomodoro}
          onResumePomodoro={controller.resumePomodoro}
          onPausePomodoro={controller.pausePomodoro}
          onResetPomodoro={controller.resetPomodoro}
          onCompleteTask={controller.completeCurrentTask}
        />
      ) : null}

      {isFocusMode ? (
        <GlobalOverlay
          overlayRef={overlayRef}
          focusIndex={overlayFocusIndex}
          visible={state.overlay.visible}
          state={state}
          screenContext={screenContext}
          onReturnOverview={controller.returnOverview}
          onModeChange={controller.setMode}
          onTogglePlay={controller.togglePlay}
          onPrevTrack={controller.prevTrack}
          onNextTrack={controller.nextTrack}
          onSetVolume={controller.setVolume}
          onSetFlowState={controller.setFlowState}
          onStartPomodoro={controller.startPomodoro}
          onResumePomodoro={controller.resumePomodoro}
          onPausePomodoro={controller.pausePomodoro}
          onResetPomodoro={controller.resetPomodoro}
          onCompleteTask={controller.completeCurrentTask}
          onInteract={scheduleOverlayHide}
          onKeepOpen={clearOverlayTimer}
        />
      ) : null}

      {debug ? (
        <div className="shell-debug-badge">
          {state.activeMode} · {transitionStatus} · {inputDebug}
        </div>
      ) : null}
    </div>
  );
}
