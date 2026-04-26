export const PERFORMANCE_RENDER_BUDGETS = {
  normal: {
    pixelRatioCap: 2,
    waveStep: 18,
    maxWaveLayers: 3,
    particleMultiplier: 1,
    frameModulo: 1,
  },
  reduced: {
    pixelRatioCap: 1.5,
    waveStep: 24,
    maxWaveLayers: 2,
    particleMultiplier: 0.55,
    frameModulo: 1,
  },
  safe: {
    pixelRatioCap: 1,
    waveStep: 32,
    maxWaveLayers: 1,
    particleMultiplier: 0.2,
    frameModulo: 2,
  },
};

export function getPerformanceRenderBudget(tier = "normal") {
  return PERFORMANCE_RENDER_BUDGETS[tier] ?? PERFORMANCE_RENDER_BUDGETS.normal;
}

export function derivePerformanceTierFromFps(avgFps, fallbackTier = "normal") {
  if (typeof avgFps !== "number" || Number.isNaN(avgFps)) {
    return fallbackTier;
  }

  if (avgFps < 24) {
    return "safe";
  }

  if (avgFps < 30) {
    return "reduced";
  }

  return "normal";
}

export function summarizeFrameWindow({ frames, elapsedMs, maxFrameDeltaMs, memory }) {
  const avgFps = elapsedMs > 0 ? Math.round((frames * 1000 * 10) / elapsedMs) / 10 : 0;
  const memoryUsageMb = memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null;

  return {
    avgFps,
    interactionLatencyMs: Math.round(Math.max(0, Number(maxFrameDeltaMs ?? 0))),
    memoryUsageMb,
    reason: "frontend_sampler",
  };
}

export function getPerformanceDebugViewModel({ system = {}, runtimeSummary = null, draftAvgFps = null } = {}) {
  const tier = system.performanceTier ?? runtimeSummary?.performanceTier ?? "normal";
  const performance = system.performance ?? {};
  const avgFps = Number(runtimeSummary?.avgFps ?? performance.avgFps ?? draftAvgFps ?? 0);
  const budget = getPerformanceRenderBudget(tier);

  return {
    tier,
    suggestedTier: derivePerformanceTierFromFps(avgFps, tier),
    avgFps,
    interactionLatencyMs: runtimeSummary?.interactionLatencyMs ?? performance.interactionLatencyMs ?? null,
    memoryUsageMb: runtimeSummary?.memoryUsageMb ?? performance.memoryUsageMb ?? null,
    lastDegradeReason: runtimeSummary?.lastDegradeReason ?? performance.lastDegradeReason ?? null,
    budget,
    budgetLabel: `ratio ${budget.pixelRatioCap} · waves ${budget.maxWaveLayers} · particles ${Math.round(
      budget.particleMultiplier * 100,
    )}% · frame/${budget.frameModulo}`,
  };
}
