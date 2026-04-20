import { useEffect } from "react";
import { AmbientBackground } from "./AmbientBackground";
import { ControlOverlay } from "./ControlOverlay";
import { SideInfoPanel } from "./SideInfoPanel";
import { StateTitle } from "./StateTitle";
import { VisualEngineCanvas } from "./VisualEngineCanvas";
import { FLOW_ORDER, FLOW_THEME } from "../theme";

function nextStateInDirection(currentState, dir) {
  const currentIndex = FLOW_ORDER.indexOf(currentState);
  const step = dir === "right" ? 1 : -1;
  const nextIndex = (currentIndex + step + FLOW_ORDER.length) % FLOW_ORDER.length;
  return FLOW_ORDER[nextIndex];
}

function deriveAppPhase({ activeMode, overlayVisible, flowState, transitionStatus }) {
  if (transitionStatus !== "idle") {
    return "transitioning";
  }

  if (flowState === "sleep" && !overlayVisible) {
    return "sleep_dimmed";
  }

  if (overlayVisible) {
    return "controls_visible";
  }

  if (activeMode !== "flow") {
    return "idle_preview";
  }

  return "immersive";
}

function createDerivedMetrics(playback, flow) {
  const metrics = flow.audioMetrics ?? {};
  return {
    volumeNormalized: playback.volume / 100,
    lowEnergy: metrics.lowEnergy ?? 0.28,
    midEnergy: metrics.midEnergy ?? 0.22,
    highEnergy: metrics.highEnergy ?? 0.18,
    beatConfidence: metrics.beatConfidence ?? 0.12,
    isPlaying: playback.state === "play",
  };
}

export function FlowModePage({
  systemState,
  onShowControls,
  onHideControls,
  onSetFlowState,
  onSetVolume,
  onTogglePlay,
  onReturnOverview,
}) {
  const transition = systemState.transition ?? {
    status: "idle",
    from: systemState.activeMode,
    to: systemState.activeMode,
    startedAt: null,
  };
  const currentState = systemState.flow.state;
  const theme = FLOW_THEME[currentState];
  const appPhase = deriveAppPhase({
    activeMode: systemState.activeMode,
    overlayVisible: systemState.overlay.visible,
    flowState: currentState,
    transitionStatus: transition.status,
  });
  const audioMetrics = createDerivedMetrics(systemState.playback, systemState.flow);
  const playerState = {
    playbackState: systemState.playback.state,
    volume: systemState.playback.volume,
    trackTitle: systemState.playback.trackTitle,
    artist: systemState.playback.artist,
    source: systemState.playback.source,
    progress: systemState.playback.progress,
  };
  const transitionState =
    transition.status !== "idle"
      ? {
          from: transition.from,
          to: transition.to,
          startedAt: transition.startedAt,
        }
      : null;

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "ArrowLeft") {
        onSetFlowState(nextStateInDirection(currentState, "left"));
        return;
      }

      if (event.key === "ArrowRight") {
        onSetFlowState(nextStateInDirection(currentState, "right"));
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Enter") {
        onShowControls();
        return;
      }

      if (event.key === "Backspace" || event.key === "Escape") {
        onReturnOverview();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentState, onReturnOverview, onSetFlowState, onShowControls]);

  function onPointerDown() {
    onShowControls();
  }

  function onTouchStart(startEvent) {
    if (startEvent.touches.length > 1) {
      return;
    }

    const startX = startEvent.touches[0]?.clientX ?? 0;

    function onTouchEnd(endEvent) {
      const endX = endEvent.changedTouches[0]?.clientX ?? startX;
      const deltaX = endX - startX;
      if (Math.abs(deltaX) > 64) {
        onSetFlowState(nextStateInDirection(currentState, deltaX > 0 ? "right" : "left"));
      } else {
        onShowControls();
      }

      window.removeEventListener("touchend", onTouchEnd);
    }

    window.addEventListener("touchend", onTouchEnd, { once: true });
  }

  return (
    <main
      className={`flow-page phase-${appPhase} tone-${theme.uiTone}`}
      onPointerDown={onPointerDown}
      onTouchStart={onTouchStart}
      role="application"
      aria-label="Flow mode"
    >
      <AmbientBackground currentState={currentState} transitionState={transitionState} />
      <VisualEngineCanvas
        currentState={currentState}
        theme={theme}
        audioMetrics={audioMetrics}
        appPhase={appPhase}
      />
      <section className="flow-page__content">
        <StateTitle title={theme.label} subtitle={theme.subtitle} appPhase={appPhase} />
        <SideInfoPanel
          playerState={playerState}
          volume={playerState.volume}
          visible={systemState.overlay.visible || appPhase === "idle_preview"}
        />
      </section>
      <ControlOverlay
        visible={systemState.overlay.visible}
        currentState={currentState}
        stateOrder={FLOW_ORDER}
        playbackState={playerState.playbackState}
        volume={playerState.volume}
        onTogglePlay={onTogglePlay}
        onVolumeChange={onSetVolume}
        onStateSelect={onSetFlowState}
        onBack={onReturnOverview}
      />
    </main>
  );
}
