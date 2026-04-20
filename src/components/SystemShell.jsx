import { useEffect, useRef, useState } from "react";
import { FlowModePage } from "./FlowModePage";
import { ListenPage } from "./ListenPage";
import { OverviewPage } from "./OverviewPage";
import { ScreenPage } from "./ScreenPage";
import { useSystemController } from "../hooks/useSystemController";

function ShellChrome({ activeMode, transitionStatus, visible, onModeChange, onReturnOverview, onTogglePlay }) {
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
      <button className="shell-button" onClick={onTogglePlay} type="button">
        Play
      </button>
    </div>
  );
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
    return "page-layer is-exiting";
  }

  if (to === pageKey) {
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
  const shouldRenderOverview =
    state.activeMode === "overview" || transition.from === "overview" || transition.to === "overview";
  const shouldRenderListen =
    state.activeMode === "listen" || transition.from === "listen" || transition.to === "listen";
  const shouldRenderFlow =
    state.activeMode === "flow" || transition.from === "flow" || transition.to === "flow";
  const shouldRenderScreen =
    state.activeMode === "screen" || transition.from === "screen" || transition.to === "screen";

  useEffect(() => {
    const shouldStickVisible = state.activeMode === "overview";
    if (shouldStickVisible) {
      setChromeVisible(true);
      if (chromeTimerRef.current) {
        window.clearTimeout(chromeTimerRef.current);
      }
      return;
    }

    setChromeVisible(false);
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

  return (
    <div
      className={`system-shell mode-${state.activeMode} transition-${transitionStatus}`}
      onPointerDown={revealChrome}
      onTouchStart={revealChrome}
    >
      {shouldRenderOverview ? (
        <OverviewPage
          className={getPageLayerClass("overview", state.activeMode, transition)}
          state={state}
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

      <ShellChrome
        activeMode={state.activeMode}
        transitionStatus={transitionStatus}
        visible={state.activeMode === "overview" ? true : chromeVisible}
        onModeChange={controller.setMode}
        onReturnOverview={controller.returnOverview}
        onTogglePlay={controller.togglePlay}
      />
      {debug ? (
        <div className="shell-debug-badge">
          {state.activeMode} · {transitionStatus}
        </div>
      ) : null}
    </div>
  );
}
