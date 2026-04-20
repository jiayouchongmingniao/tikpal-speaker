import { AmbientBackground } from "./AmbientBackground";
import { SideInfoPanel } from "./SideInfoPanel";
import { StateTitle } from "./StateTitle";
import { VisualEngineCanvas } from "./VisualEngineCanvas";
import { FLOW_THEME } from "../theme";

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

function toFlowTransitionState(transition, currentState) {
  if (!transition || transition.status === "idle") {
    return null;
  }

  const fromState = FLOW_THEME[transition.from] ? transition.from : currentState;
  const toState = FLOW_THEME[transition.to] ? transition.to : currentState;

  return {
    from: fromState,
    to: toState,
    startedAt: transition.startedAt,
  };
}

export function FlowModePage({
  systemState,
  className = "",
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
  const transitionState = toFlowTransitionState(transition, currentState);

  return (
    <main className={`flow-page phase-${appPhase} tone-${theme.uiTone} ${className}`.trim()} role="application" aria-label="Flow mode">
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
    </main>
  );
}
