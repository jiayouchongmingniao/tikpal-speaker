import { FLOW_THEME } from "../theme.js";
import { getPerformanceRenderBudget, isStaticFlowRenderBudget, normalizeRenderProfile } from "./performance.js";

export function deriveFlowAppPhase({ activeMode, overlayVisible, flowState, transitionStatus }) {
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

export function toFlowTransitionState(transition, currentState) {
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

export function deriveAmbientBackgroundDiagnostics({
  transitionState,
  appPhase = "immersive",
  renderProfile = "off",
  performanceTier = "normal",
  flowDiagnosticMode = "off",
} = {}) {
  const normalizedProfile = normalizeRenderProfile(renderProfile);
  const isTransitioning = appPhase === "transitioning";
  const isStableProfile = normalizedProfile === "balanced" || normalizedProfile === "stable";
  const isLowPowerTier = performanceTier === "safe" || (normalizedProfile === "stable" && performanceTier !== "normal");
  const isStaticDiagnostic = flowDiagnosticMode === "static";
  const rawNextOpacity = isTransitioning
    ? 0.52
    : normalizedProfile === "stable"
      ? 0.22
      : isStableProfile
        ? 0.48
        : 0.58;
  const nextLayerOpacity = transitionState ? rawNextOpacity : rawNextOpacity * 0.82;
  const nextLayerBlendMode = isStaticDiagnostic || normalizedProfile === "stable" || isLowPowerTier ? "normal" : isStableProfile ? "soft-light" : "screen";
  const nextLayerBlurPx = normalizedProfile === "stable" || isStaticDiagnostic || isLowPowerTier ? 0 : isStableProfile ? 8 : 12;
  const profileSuppressed = normalizedProfile === "stable" || isLowPowerTier || isStaticDiagnostic;
  const backgroundLayeringActive = !profileSuppressed || nextLayerOpacity >= 0.42;

  return {
    backgroundLayeringActive,
    profileSuppressed,
    nextLayerOpacity,
    nextLayerBlendMode,
    nextLayerBlurPx,
  };
}

export function deriveFlowRenderDiagnostics({
  systemState = {},
  runtimeProfile = null,
  canvasDebug = null,
} = {}) {
  const transition = systemState.transition ?? {
    status: "idle",
    from: systemState.activeMode,
    to: systemState.activeMode,
  };
  const flowState = systemState.flow?.state ?? "focus";
  const performanceTier = systemState.system?.performanceTier ?? runtimeProfile?.activeTier ?? "normal";
  const renderProfile = normalizeRenderProfile(systemState.system?.renderProfile ?? runtimeProfile?.renderProfile ?? "off");
  const appPhase = deriveFlowAppPhase({
    activeMode: systemState.activeMode ?? "overview",
    overlayVisible: Boolean(systemState.overlay?.visible),
    flowState,
    transitionStatus: transition.status ?? "idle",
  });
  const desiredLayerCount =
    canvasDebug?.desiredLayerCount ?? (appPhase === "transitioning" ? 1 : flowState === "flow" ? 3 : 2);
  const renderBudget = runtimeProfile?.activeBudget ?? getPerformanceRenderBudget(performanceTier, renderProfile);
  const staticFlowBudget = isStaticFlowRenderBudget(renderBudget);
  const minimalFlowBudget = renderBudget?.flowSceneMode === "minimal";
  const maxWaveLayers = Number(renderBudget.maxWaveLayers ?? desiredLayerCount);
  const actualLayerCount =
    canvasDebug?.layerCount ?? Math.min(Number(desiredLayerCount ?? 1), Number.isFinite(maxWaveLayers) ? maxWaveLayers : desiredLayerCount);
  const transitionState = toFlowTransitionState(transition, flowState);
  const ambientDiagnostics = deriveAmbientBackgroundDiagnostics({
    transitionState,
    appPhase,
    renderProfile,
    performanceTier,
    flowDiagnosticMode: systemState.system?.flowDiagnosticMode ?? "off",
  });
  const waveVisualMode = actualLayerCount <= 1 ? "single-wave" : "multi-wave";
  const budgetLimited = actualLayerCount < desiredLayerCount;

  let primaryReason = "full_flow_budget";
  if (appPhase === "transitioning") {
    primaryReason = "transition_phase";
  } else if (staticFlowBudget) {
    primaryReason = "static_budget";
  } else if (minimalFlowBudget) {
    primaryReason = "minimal_budget";
  } else if (budgetLimited) {
    primaryReason = "performance_budget";
  } else if (waveVisualMode === "single-wave" && ambientDiagnostics.backgroundLayeringActive) {
    primaryReason = "background_layering";
  }

  let explanation = `Rendering ${actualLayerCount} wave layers with full Flow budget.`;
  if (primaryReason === "transition_phase") {
    explanation = "Transition phase forces the canvas down to one wave layer until the mode settles.";
  } else if (primaryReason === "static_budget") {
    explanation = "Static Flow budget freezes the scene to protect device stability on the lowest runtime tier.";
  } else if (primaryReason === "minimal_budget") {
    explanation = "Minimal Flow budget keeps one animated wave and removes secondary effects to stay within the device budget.";
  } else if (primaryReason === "performance_budget") {
    explanation = `Performance budget caps waves at ${maxWaveLayers}, so the canvas is below the desired ${desiredLayerCount} layers.`;
  } else if (primaryReason === "background_layering") {
    explanation = "The canvas is down to one real wave layer, but the ambient next/background layers can still make it look doubled.";
  }

  return {
    appPhase,
    performanceTier,
    renderProfile,
    desiredLayerCount,
    actualLayerCount,
    maxWaveLayers,
    waveVisualMode,
    staticFlowBudget,
    minimalFlowBudget,
    primaryReason,
    backgroundLayeringActive: ambientDiagnostics.backgroundLayeringActive,
    ambientDiagnostics,
    explanation,
  };
}
