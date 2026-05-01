import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const BACKGROUND_CROSSFADE_MS = 1500;
const SCENE_PROMPT_VISIBLE_MS = 3000;
const FLOW_AUDIO_METRICS = {
  focus: { lowEnergy: 0.28, midEnergy: 0.22, highEnergy: 0.14, beatConfidence: 0.16 },
  flow: { lowEnergy: 0.38, midEnergy: 0.32, highEnergy: 0.22, beatConfidence: 0.24 },
  relax: { lowEnergy: 0.24, midEnergy: 0.18, highEnergy: 0.12, beatConfidence: 0.1 },
  sleep: { lowEnergy: 0.12, midEnergy: 0.08, highEnergy: 0.04, beatConfidence: 0.04 },
};

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
  const previousSceneRef = useRef(currentScene);
  const scenePromptTimerRef = useRef(null);
  const lastPromptSceneIdRef = useRef(currentScene.id);
  const [previousScene, setPreviousScene] = useState(null);
  const [scenePromptVisible, setScenePromptVisible] = useState(false);
  const appPhase = deriveFlowAppPhase({
    activeMode: systemState.activeMode,
    overlayVisible: systemState.overlay.visible,
    flowState: currentState,
    transitionStatus: transition.status,
  });
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
  const flowRenderer = runtimeRendererConfig.flowRenderer;
  const chromiumExperiment = runtimeRendererConfig.chromiumExperiment;
  const isImageRenderer = flowRenderer === "image";
  const audioMetricsBase = FLOW_AUDIO_METRICS[currentState] ?? FLOW_AUDIO_METRICS.focus;
  const audioMetrics = {
    volumeNormalized: Math.max(0, Math.min(1, Number(playerState.volume ?? 0) / 100)),
    ...audioMetricsBase,
    isPlaying: playerState.playbackState === "play",
  };
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

  useLayoutEffect(() => {
    const lastScene = previousSceneRef.current;
    previousSceneRef.current = currentScene;

    if (!lastScene || lastScene.id === currentScene.id || !lastScene.artwork || !currentScene.artwork) {
      return undefined;
    }

    setPreviousScene(lastScene);
    const timeout = window.setTimeout(() => {
      setPreviousScene((scene) => (scene?.id === lastScene.id ? null : scene));
    }, BACKGROUND_CROSSFADE_MS);

    return () => window.clearTimeout(timeout);
  }, [currentScene]);

  useEffect(() => {
    if (lastPromptSceneIdRef.current === currentScene.id) {
      return undefined;
    }

    lastPromptSceneIdRef.current = currentScene.id;
    setScenePromptVisible(true);
    window.clearTimeout(scenePromptTimerRef.current);
    scenePromptTimerRef.current = window.setTimeout(() => {
      setScenePromptVisible(false);
    }, SCENE_PROMPT_VISIBLE_MS);

    return () => window.clearTimeout(scenePromptTimerRef.current);
  }, [currentScene.id]);

  useEffect(
    () => () => {
      window.clearTimeout(scenePromptTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (!isImageRenderer) {
      return undefined;
    }

    function updateStaticBackgroundDebug() {
      window.__TIKPAL_CANVAS_DEBUG__ = {
        skippedRenderCount: 0,
        resizeCommitCount: 0,
        transitionFrameBudgetHits: appPhase === "transitioning" ? 1 : 0,
        lastFrameIntervalMs: Number(renderBudget.frameIntervalMs ?? 0),
        width: window.innerWidth,
        height: window.innerHeight,
        ratio: 1,
        renderScale: 1,
        effectiveRatio: 1,
        desiredLayerCount: 0,
        layerCount: 0,
        flowDiagnosticMode,
        staticSceneActive: true,
        lowPowerBudget: true,
        flowSceneMode: "static",
        phase: previousScene ? "image_crossfade" : appPhase,
        rendererType: "image",
        requestedRenderer: "image",
        rendererFallbackCount: 0,
        glInitErrorCount: 0,
        glContextLostCount: 0,
        rendererFallbackReason: null,
        chromiumExperiment,
      };
    }

    updateStaticBackgroundDebug();
    window.addEventListener("resize", updateStaticBackgroundDebug);
    return () => {
      window.removeEventListener("resize", updateStaticBackgroundDebug);
      if (window.__TIKPAL_CANVAS_DEBUG__?.rendererType === "image") {
        delete window.__TIKPAL_CANVAS_DEBUG__;
      }
    };
  }, [appPhase, chromiumExperiment, flowDiagnosticMode, isImageRenderer, previousScene, renderBudget.frameIntervalMs]);

  return (
    <main
      className={`flow-page phase-${appPhase} tone-${theme.uiTone} care-${creativeCare.currentCareMode} render-profile-${renderProfile} ${
        isStaticFlowBudget ? "flow-page--static-budget" : ""
      } ${
        isMinimalFlowBudget ? "flow-page--minimal-budget" : ""
      } ${
        previousScene ? "flow-page--image-crossfading" : ""
      } ${
        isImageRenderer ? "flow-page--image-background" : `flow-page--visual-renderer flow-page--${flowRenderer}-renderer`
      } ${className}`.trim()}
      role="application"
      aria-label="Flow mode"
    >
      {isImageRenderer ? (
        <AmbientBackground
          currentState={currentState}
          scene={currentScene}
          previousScene={previousScene}
          transitionState={transitionState}
          appPhase={appPhase}
          performanceTier={performanceTier}
          renderProfile={renderProfile}
          flowDiagnosticMode={flowDiagnosticMode}
          imageOnly
        />
      ) : (
        <FlowVisualRenderer
          currentState={currentState}
          theme={theme}
          audioMetrics={audioMetrics}
          appPhase={appPhase}
          renderBudget={renderBudget}
          flowDiagnosticMode={flowDiagnosticMode}
          rendererPreference={flowRenderer}
          chromiumExperiment={chromiumExperiment}
        />
      )}
      <section className="flow-page__content">
        <div className="flow-care-stack">
          <StateTitle title={careCopy.label} subtitle={careCopy.subtitle} appPhase={appPhase} />
          <p className="flow-care-insight">{creativeCare.insightSentence}</p>
        </div>
        <div className="flow-page__aside">
          <aside
            className={`flow-scene-card flow-scene-card--prompt ${scenePromptVisible ? "is-visible" : ""}`}
            aria-hidden={scenePromptVisible ? "false" : "true"}
          >
            <span className="flow-scene-card__kicker">{careCopy.label} Scene {currentScene.index + 1}/5</span>
            <strong>{currentScene.label}</strong>
            <p>{currentScene.subtitle}</p>
            {currentScene.ritualLabelZh ? <span className="flow-scene-card__meta">{currentScene.ritualLabelZh}</span> : null}
          </aside>
          <SideInfoPanel
            playerState={playerState}
            volume={playerState.volume}
            visible={systemState.overlay.visible || appPhase === "idle_preview"}
          />
        </div>
      </section>
    </main>
  );
}
