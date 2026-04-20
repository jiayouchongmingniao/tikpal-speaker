import { useEffect, useRef, useState } from "react";
import { FlowModePage } from "./FlowModePage";
import { ListenPage } from "./ListenPage";
import { OverviewPage } from "./OverviewPage";
import { ScreenPage } from "./ScreenPage";
import { useSystemController } from "../hooks/useSystemController";

function ShellChrome({ activeMode, transitionStatus, visible, onModeChange, onReturnOverview }) {
  const isLocked = transitionStatus !== "idle";

  return (
    <div className={`shell-chrome ${visible ? "is-visible" : "is-hidden"}`}>
      <button className="shell-button shell-button--ghost" onClick={onReturnOverview} type="button" disabled={isLocked}>
        Overview
      </button>
      <div className="shell-mode-switcher" role="tablist" aria-label="System modes">
        {["listen", "flow", "screen"].map((mode) => (
          <button
            key={mode}
            className={`shell-mode-chip ${activeMode === mode ? "is-active" : ""}`}
            onClick={() => onModeChange(mode)}
            type="button"
            disabled={isLocked}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}

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

export function SystemShell({ initialMode = "overview", initialFlowState = "focus", debug = false }) {
  const controller = useSystemController({ initialMode, initialFlowState });
  const { state } = controller;
  const [chromeVisible, setChromeVisible] = useState(true);
  const chromeTimerRef = useRef(null);
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

  useEffect(() => {
    const shouldStickVisible = state.activeMode === "overview";
    if (shouldStickVisible) {
      setChromeVisible(true);
      if (chromeTimerRef.current) {
        window.clearTimeout(chromeTimerRef.current);
      }
      return;
    }

    setChromeVisible(true);
    if (chromeTimerRef.current) {
      window.clearTimeout(chromeTimerRef.current);
    }
    chromeTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false);
    }, 2200);
  }, [state.activeMode]);

  useEffect(
    () => () => {
      if (chromeTimerRef.current) {
        window.clearTimeout(chromeTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    function revealChrome() {
      if (state.activeMode === "overview") {
        return;
      }

      setChromeVisible(true);
      if (chromeTimerRef.current) {
        window.clearTimeout(chromeTimerRef.current);
      }
      chromeTimerRef.current = window.setTimeout(() => {
        setChromeVisible(false);
      }, 2600);
    }

    function onKeyDown(event) {
      revealChrome();

      if (event.key === "Escape" || event.key === "Backspace") {
        controller.returnOverview();
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
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller, state.activeMode]);

  function revealChrome() {
    if (state.activeMode === "overview") {
      return;
    }

    setChromeVisible(true);
    if (chromeTimerRef.current) {
      window.clearTimeout(chromeTimerRef.current);
    }
    chromeTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false);
    }, 2600);
  }

  function onShellTouchStart(event) {
    if (state.activeMode === "overview" || event.touches.length < 2) {
      revealChrome();
      return;
    }

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

  return (
    <div
      className={`system-shell mode-${state.activeMode} transition-${transitionStatus}`}
      onPointerDown={revealChrome}
      onTouchStart={onShellTouchStart}
    >
      {shouldRenderOverview ? (
        <OverviewPage
          className={getPageLayerClass("overview", state.activeMode, transition)}
          state={state}
          focusTarget={overviewFocusTarget}
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
        <FlowModePage
          className={getPageLayerClass("flow", state.activeMode, transition)}
          systemState={state}
          onShowControls={controller.showControls}
          onHideControls={controller.hideControls}
          onSetFlowState={controller.setFlowState}
          onSetVolume={controller.setVolume}
          onTogglePlay={controller.togglePlay}
          onReturnOverview={controller.returnOverview}
        />
      ) : null}

      {shouldRenderScreen ? (
        <ScreenPage
          className={getPageLayerClass("screen", state.activeMode, transition)}
          state={state}
          onStartPomodoro={controller.startPomodoro}
          onResumePomodoro={controller.resumePomodoro}
          onPausePomodoro={controller.pausePomodoro}
          onResetPomodoro={controller.resetPomodoro}
          onCompleteTask={controller.completeCurrentTask}
        />
      ) : null}

      {isFocusMode ? (
        <ShellChrome
          activeMode={state.activeMode}
          transitionStatus={transitionStatus}
          visible={chromeVisible}
          onModeChange={controller.setMode}
          onReturnOverview={controller.returnOverview}
        />
      ) : null}
      {debug ? (
        <div className="shell-debug-badge">
          {state.activeMode} · {transitionStatus}
        </div>
      ) : null}
    </div>
  );
}
