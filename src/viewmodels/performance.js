export const PERFORMANCE_RENDER_BUDGETS = {
  normal: {
    pixelRatioCap: 2,
    renderScale: 1,
    waveStep: 18,
    maxWaveLayers: 3,
    particleMultiplier: 1,
    frameIntervalMs: 16,
    flowSceneMode: "animated",
  },
  reduced: {
    pixelRatioCap: 1.5,
    renderScale: 1,
    waveStep: 24,
    maxWaveLayers: 2,
    particleMultiplier: 0.55,
    frameIntervalMs: 33,
    flowSceneMode: "animated",
  },
  safe: {
    pixelRatioCap: 1,
    renderScale: 1,
    waveStep: 32,
    maxWaveLayers: 1,
    particleMultiplier: 0.2,
    frameIntervalMs: 42,
    flowSceneMode: "animated",
  },
};

export const PI4_TARGET_FRAME_INTERVAL_MS = 33;

export const RPI_RENDER_PROFILE_OVERRIDES = {
  balanced: {
    normal: {
      pixelRatioCap: 1.2,
      renderScale: 0.82,
      waveStep: 26,
      maxWaveLayers: 3,
      particleMultiplier: 0.42,
      frameIntervalMs: PI4_TARGET_FRAME_INTERVAL_MS,
      flowSceneMode: "animated",
    },
    reduced: {
      pixelRatioCap: 0.9,
      renderScale: 0.5,
      waveStep: 46,
      maxWaveLayers: 2,
      particleMultiplier: 0.12,
      frameIntervalMs: PI4_TARGET_FRAME_INTERVAL_MS,
      flowSceneMode: "animated",
    },
    safe: {
      pixelRatioCap: 0.56,
      renderScale: 0.28,
      waveStep: 96,
      maxWaveLayers: 1,
      particleMultiplier: 0,
      frameIntervalMs: PI4_TARGET_FRAME_INTERVAL_MS,
      flowSceneMode: "minimal",
    },
  },
  stable: {
    normal: {
      pixelRatioCap: 0.82,
      renderScale: 0.5,
      waveStep: 40,
      maxWaveLayers: 2,
      particleMultiplier: 0.16,
      frameIntervalMs: PI4_TARGET_FRAME_INTERVAL_MS,
      flowSceneMode: "animated",
    },
    reduced: {
      pixelRatioCap: 0.62,
      renderScale: 0.36,
      waveStep: 80,
      maxWaveLayers: 1,
      particleMultiplier: 0.04,
      frameIntervalMs: PI4_TARGET_FRAME_INTERVAL_MS,
      flowSceneMode: "minimal",
    },
    safe: {
      pixelRatioCap: 0.45,
      renderScale: 0.2,
      waveStep: 132,
      maxWaveLayers: 1,
      particleMultiplier: 0,
      frameIntervalMs: PI4_TARGET_FRAME_INTERVAL_MS,
      flowSceneMode: "minimal",
    },
  },
};

export function normalizeRenderProfile(profile = "off") {
  return profile === "balanced" || profile === "stable" ? profile : "off";
}

export function getPerformanceRenderBudget(tier = "normal", profile = "off") {
  const normalizedTier = PERFORMANCE_RENDER_BUDGETS[tier] ? tier : "normal";
  const normalizedProfile = normalizeRenderProfile(profile);
  const base = PERFORMANCE_RENDER_BUDGETS[normalizedTier];
  if (normalizedProfile === "off") {
    return base;
  }
  return {
    ...base,
    ...(RPI_RENDER_PROFILE_OVERRIDES[normalizedProfile]?.[normalizedTier] ?? {}),
  };
}

export function isStaticFlowRenderBudget(budget = {}) {
  return budget?.flowSceneMode === "static";
}

export function isMinimalFlowRenderBudget(budget = {}) {
  return budget?.flowSceneMode === "minimal";
}

export function derivePerformanceTierFromFps(avgFps, fallbackTier = "normal") {
  if (typeof avgFps !== "number" || Number.isNaN(avgFps)) {
    return fallbackTier;
  }

  if (avgFps < 30) {
    return "safe";
  }

  if (avgFps < 36) {
    return "reduced";
  }

  return "normal";
}

export function summarizeFrameWindow({ frames, elapsedMs, maxFrameDeltaMs, memory, diagnostics = null }) {
  const avgFps = elapsedMs > 0 ? Math.round((frames * 1000 * 10) / elapsedMs) / 10 : 0;
  const memoryUsageMb = memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null;

  return {
    avgFps,
    interactionLatencyMs: Math.round(Math.max(0, Number(maxFrameDeltaMs ?? 0))),
    memoryUsageMb,
    reason: "frontend_sampler",
    ...(diagnostics ? { diagnostics } : {}),
  };
}

function percentile(values, ratio) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

function roundMetric(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

export function summarizePerformanceTrace(samples = []) {
  const normalizedSamples = (Array.isArray(samples) ? samples : [])
    .map((sample) => ({
      ...sample,
      avgFps: Number(sample.avgFps),
      interactionLatencyMs:
        sample.interactionLatencyMs === null || sample.interactionLatencyMs === undefined
          ? null
          : Number(sample.interactionLatencyMs),
      memoryUsageMb: sample.memoryUsageMb === null || sample.memoryUsageMb === undefined ? null : Number(sample.memoryUsageMb),
    }))
    .filter((sample) => Number.isFinite(sample.avgFps));
  const fpsValues = normalizedSamples.map((sample) => sample.avgFps);
  const latencyValues = normalizedSamples
    .map((sample) => sample.interactionLatencyMs)
    .filter((value) => Number.isFinite(value));
  const memoryValues = normalizedSamples
    .map((sample) => sample.memoryUsageMb)
    .filter((value) => Number.isFinite(value));
  const avgFps = fpsValues.length ? fpsValues.reduce((sum, value) => sum + value, 0) / fpsValues.length : null;
  const p10Fps = percentile(fpsValues, 0.1);
  const minFps = fpsValues.length ? Math.min(...fpsValues) : null;
  const maxInteractionLatencyMs = latencyValues.length ? Math.max(...latencyValues) : null;
  const maxMemoryUsageMb = memoryValues.length ? Math.max(...memoryValues) : null;
  const recommendedTier = derivePerformanceTierFromFps(Math.min(avgFps ?? 60, p10Fps ?? avgFps ?? 60));
  const reasons = [];

  if (p10Fps !== null && p10Fps < 30) {
    reasons.push("p10_fps_below_30");
  } else if (p10Fps !== null && p10Fps < 36) {
    reasons.push("p10_fps_below_36");
  }

  if (maxInteractionLatencyMs !== null && maxInteractionLatencyMs > 80) {
    reasons.push("interaction_latency_above_80ms");
  }

  return {
    sampleCount: normalizedSamples.length,
    avgFps: roundMetric(avgFps),
    p10Fps: roundMetric(p10Fps),
    minFps: roundMetric(minFps),
    maxInteractionLatencyMs: roundMetric(maxInteractionLatencyMs),
    maxMemoryUsageMb: roundMetric(maxMemoryUsageMb),
    recommendedTier,
    reasons,
  };
}

export function getPerformanceDebugViewModel({ system = {}, runtimeSummary = null, draftAvgFps = null } = {}) {
  const tier = system.performanceTier ?? runtimeSummary?.performanceTier ?? "normal";
  const performance = system.performance ?? {};
  const renderProfile = normalizeRenderProfile(system.renderProfile ?? runtimeSummary?.renderProfile ?? "off");
  const avgFps = Number(runtimeSummary?.avgFps ?? performance.avgFps ?? draftAvgFps ?? 0);
  const budget = getPerformanceRenderBudget(tier, renderProfile);
  const tierCooldownUntil = runtimeSummary?.tierCooldownUntil ?? performance.tierCooldownUntil ?? null;
  const tierCooldownRemainingMs = runtimeSummary?.tierCooldownRemainingMs ?? performance.tierCooldownRemainingMs ?? null;
  const tierDecisionReason = runtimeSummary?.tierDecisionReason ?? performance.tierDecisionReason ?? null;
  const performanceTierUpdatedAt = runtimeSummary?.performanceTierUpdatedAt ?? performance.performanceTierUpdatedAt ?? null;

  return {
    tier,
    suggestedTier: derivePerformanceTierFromFps(avgFps, tier),
    renderProfile,
    rendererType: runtimeSummary?.rendererType ?? performance.rendererType ?? "canvas",
    requestedRenderer: runtimeSummary?.requestedRenderer ?? performance.requestedRenderer ?? "canvas",
    chromiumExperiment: runtimeSummary?.chromiumExperiment ?? performance.chromiumExperiment ?? "baseline",
    avgFps,
    interactionLatencyMs: runtimeSummary?.interactionLatencyMs ?? performance.interactionLatencyMs ?? null,
    memoryUsageMb: runtimeSummary?.memoryUsageMb ?? performance.memoryUsageMb ?? null,
    lastDegradeReason: runtimeSummary?.lastDegradeReason ?? performance.lastDegradeReason ?? null,
    rendererFallbackCount: runtimeSummary?.rendererFallbackCount ?? performance.rendererFallbackCount ?? 0,
    glInitErrorCount: runtimeSummary?.glInitErrorCount ?? performance.glInitErrorCount ?? 0,
    glContextLostCount: runtimeSummary?.glContextLostCount ?? performance.glContextLostCount ?? 0,
    rendererFallbackReason: runtimeSummary?.rendererFallbackReason ?? performance.rendererFallbackReason ?? null,
    tierDecisionReason,
    tierCooldownUntil,
    tierCooldownRemainingMs,
    performanceTierUpdatedAt,
    budget,
    budgetLabel: `ratio ${budget.pixelRatioCap} · waves ${budget.maxWaveLayers} · particles ${Math.round(
      budget.particleMultiplier * 100,
    )}% · scale ${Math.round((budget.renderScale ?? 1) * 100)}% · ${Math.round(1000 / Math.max(16, Number(budget.frameIntervalMs ?? 16)))}fps`,
  };
}
