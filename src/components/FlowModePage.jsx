import { useEffect } from "react";
import { AmbientBackground } from "./AmbientBackground";
import { FlowVisualRenderer } from "./FlowVisualRenderer";
import { SideInfoPanel } from "./SideInfoPanel";
import { StateTitle } from "./StateTitle";
import { FLOW_THEME } from "../theme";
import { getCreativeCareViewModel, getFlowCareCopy } from "../viewmodels/creativeCare";
import { getFlowScenesForState } from "../viewmodels/flowScenes";
import { deriveFlowAppPhase, toFlowTransitionState } from "../viewmodels/flowRenderDiagnostics";
import { getFlowRendererRuntimeConfig } from "../viewmodels/flowRenderer";
import {
  getPerformanceRenderBudget,
  isMinimalFlowRenderBudget,
  isStaticFlowRenderBudget,
  normalizeRenderProfile,
} from "../viewmodels/performance";

function createDerivedMetrics(playback, flow, creativeCare) {
  const metrics = flow.audioMetrics ?? {};
  const intensity = Number(creativeCare?.moodIntensity ?? 0.45);
  const careMode = creativeCare?.currentCareMode ?? "flow";
  const careLift = careMode === "sleep" ? -0.12 : careMode === "unwind" ? -0.05 : careMode === "focus" ? 0.04 : 0.08;
  return {
    volumeNormalized: playback.volume / 100,
    lowEnergy: Math.max(0.08, Math.min(0.7, (metrics.lowEnergy ?? 0.28) + intensity * 0.08 + careLift)),
    midEnergy: Math.max(0.06, Math.min(0.6, (metrics.midEnergy ?? 0.22) + intensity * 0.06 + careLift / 2)),
    highEnergy: Math.max(0.04, Math.min(0.5, (metrics.highEnergy ?? 0.18) + intensity * 0.04)),
    beatConfidence: metrics.beatConfidence ?? 0.12,
    isPlaying: playback.state === "play",
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
  const creativeCare = getCreativeCareViewModel(systemState);
  const careCopy = getFlowCareCopy(currentState);
  const scenes = getFlowScenesForState(currentState);
  const currentScene = scenes.find((scene) => scene.id === systemState.flow.sceneId) ?? scenes[0];
  const appPhase = deriveFlowAppPhase({
    activeMode: systemState.activeMode,
    overlayVisible: systemState.overlay.visible,
    flowState: currentState,
    transitionStatus: transition.status,
  });
  const audioMetrics = createDerivedMetrics(systemState.playback, systemState.flow, creativeCare);
  const playerState = {
    playbackState: systemState.playback.state,
    volume: systemState.playback.volume,
    trackTitle: systemState.playback.trackTitle,
    artist: systemState.playback.artist,
    source: systemState.playback.source,
    progress: systemState.playback.progress,
  };
  const transitionState = toFlowTransitionState(transition, currentState);
  const performanceTier = systemState.system?.performanceTier ?? "normal";
  const renderProfile = normalizeRenderProfile(systemState.system?.renderProfile ?? "off");
  const flowDiagnosticMode = systemState.system?.flowDiagnosticMode === "static" ? "static" : "off";
  const renderBudget = getPerformanceRenderBudget(performanceTier, renderProfile);
  const runtimeRendererConfig = getFlowRendererRuntimeConfig(window.location);
  const isStaticFlowBudget = isStaticFlowRenderBudget(renderBudget);
  const isMinimalFlowBudget = isMinimalFlowRenderBudget(renderBudget);

  useEffect(() => {
    if (renderProfile === "stable") {
      return undefined;
    }

    const nextScene = scenes[(currentScene.index + 1) % scenes.length];
    [currentScene.artwork, nextScene.artwork].forEach((src) => {
      const image = new Image();
      image.src = src;
    });
    return undefined;
  }, [currentScene.artwork, currentScene.index, renderProfile, scenes]);

  return (
    <main
      className={`flow-page phase-${appPhase} tone-${theme.uiTone} care-${creativeCare.currentCareMode} render-profile-${renderProfile} ${
        isStaticFlowBudget ? "flow-page--static-budget" : ""
      } ${
        isMinimalFlowBudget ? "flow-page--minimal-budget" : ""
      } ${className}`.trim()}
      role="application"
      aria-label="Flow mode"
    >
      <AmbientBackground
        currentState={currentState}
        scene={currentScene}
        transitionState={transitionState}
        appPhase={appPhase}
        performanceTier={performanceTier}
        renderProfile={renderProfile}
        flowDiagnosticMode={flowDiagnosticMode}
      />
      <FlowVisualRenderer
        currentState={currentState}
        theme={theme}
        audioMetrics={audioMetrics}
        appPhase={appPhase}
        renderBudget={renderBudget}
        flowDiagnosticMode={flowDiagnosticMode}
        rendererPreference={runtimeRendererConfig.flowRenderer}
        chromiumExperiment={runtimeRendererConfig.chromiumExperiment}
      />
      <section className="flow-page__content">
        <div className="flow-care-stack">
          <div className="flow-scene-card">
            <span className="flow-scene-card__kicker">{careCopy.label} Scene {currentScene.index + 1}/5</span>
            <strong>{currentScene.label}</strong>
            <p>{currentScene.subtitle}</p>
            {currentScene.ritualLabelZh ? <span className="flow-scene-card__meta">{currentScene.ritualLabelZh}</span> : null}
          </div>
          <StateTitle title={careCopy.label} subtitle={careCopy.subtitle} appPhase={appPhase} />
          <p className="flow-care-insight">{creativeCare.insightSentence}</p>
        </div>
        <SideInfoPanel
          playerState={playerState}
          volume={playerState.volume}
          visible={systemState.overlay.visible || appPhase === "idle_preview"}
        />
      </section>
    </main>
  );
}
