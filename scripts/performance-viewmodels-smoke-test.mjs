import assert from "node:assert/strict";
import { deriveFlowRenderDiagnostics } from "../src/viewmodels/flowRenderDiagnostics.js";
import {
  derivePerformanceTierFromFps,
  getPerformanceDebugViewModel,
  getPerformanceRenderBudget,
  isStaticFlowRenderBudget,
  summarizeFrameWindow,
  summarizePerformanceTrace,
} from "../src/viewmodels/performance.js";

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("performance tier thresholds match runtime telemetry policy", () => {
  assert.equal(derivePerformanceTierFromFps(60), "normal");
  assert.equal(derivePerformanceTierFromFps(30), "normal");
  assert.equal(derivePerformanceTierFromFps(29.9), "reduced");
  assert.equal(derivePerformanceTierFromFps(24), "reduced");
  assert.equal(derivePerformanceTierFromFps(23.9), "safe");
  assert.equal(derivePerformanceTierFromFps(Number.NaN, "reduced"), "reduced");
});

test("render budgets progressively reduce canvas cost", () => {
  const normal = getPerformanceRenderBudget("normal");
  const reduced = getPerformanceRenderBudget("reduced");
  const safe = getPerformanceRenderBudget("safe");

  assert.equal(normal.maxWaveLayers > reduced.maxWaveLayers, true);
  assert.equal(reduced.maxWaveLayers > safe.maxWaveLayers, true);
  assert.equal(normal.particleMultiplier > reduced.particleMultiplier, true);
  assert.equal(reduced.particleMultiplier > safe.particleMultiplier, true);
  assert.equal(normal.pixelRatioCap > safe.pixelRatioCap, true);
  assert.equal(normal.frameIntervalMs < safe.frameIntervalMs, true);
  assert.deepEqual(getPerformanceRenderBudget("unknown"), normal);
});

test("rpi render profiles tighten budgets while desktop defaults stay unchanged", () => {
  const desktop = getPerformanceRenderBudget("normal", "off");
  const balanced = getPerformanceRenderBudget("normal", "balanced");
  const stable = getPerformanceRenderBudget("normal", "stable");
  const stableSafe = getPerformanceRenderBudget("safe", "stable");

  assert.equal(desktop.pixelRatioCap > balanced.pixelRatioCap, true);
  assert.equal(balanced.pixelRatioCap > stable.pixelRatioCap, true);
  assert.equal(desktop.maxWaveLayers > balanced.maxWaveLayers, true);
  assert.equal(balanced.particleMultiplier > stable.particleMultiplier, true);
  assert.equal(stableSafe.renderScale, 0.24);
  assert.equal(isStaticFlowRenderBudget(stableSafe), false);
  assert.equal(stableSafe.flowSceneMode, "minimal");
});

test("frame window summary reports fps, latency, and optional memory", () => {
  const summary = summarizeFrameWindow({
    frames: 120,
    elapsedMs: 2000,
    maxFrameDeltaMs: 41.4,
    memory: {
      usedJSHeapSize: 32.4 * 1024 * 1024,
    },
    diagnostics: {
      skippedRenderCount: 3,
      resizeCommitCount: 1,
    },
  });

  assert.equal(summary.avgFps, 60);
  assert.equal(summary.interactionLatencyMs, 41);
  assert.equal(summary.memoryUsageMb, 32);
  assert.equal(summary.reason, "frontend_sampler");
  assert.deepEqual(summary.diagnostics, {
    skippedRenderCount: 3,
    resizeCommitCount: 1,
  });
});

test("debug view model combines runtime metrics with render budget", () => {
  const viewModel = getPerformanceDebugViewModel({
    system: {
      performanceTier: "reduced",
      renderProfile: "balanced",
      performance: {
        avgFps: 28,
        interactionLatencyMs: 38,
        memoryUsageMb: 96,
        lastDegradeReason: "fps",
        tierDecisionReason: "pending_degrade_1/2",
        tierCooldownRemainingMs: 0,
      },
    },
  });

  assert.equal(viewModel.tier, "reduced");
  assert.equal(viewModel.renderProfile, "balanced");
  assert.equal(viewModel.suggestedTier, "reduced");
  assert.equal(viewModel.budget.maxWaveLayers, 1);
  assert.equal(viewModel.budget.renderScale, 1);
  assert.equal(viewModel.budgetLabel.includes("particles 24%"), true);
  assert.equal(viewModel.budgetLabel.includes("scale 100%"), true);
  assert.equal(viewModel.tierDecisionReason, "pending_degrade_1/2");
});

test("flow render diagnostics explain full budget, budget-limited, and transition states", () => {
  const fullBudget = deriveFlowRenderDiagnostics({
    systemState: {
      activeMode: "flow",
      overlay: { visible: false },
      transition: { status: "idle", from: "flow", to: "flow" },
      flow: { state: "flow" },
      system: { performanceTier: "normal", renderProfile: "off" },
    },
    runtimeProfile: {
      activeBudget: getPerformanceRenderBudget("normal", "off"),
      activeTier: "normal",
      renderProfile: "off",
    },
    canvasDebug: {
      desiredLayerCount: 3,
      layerCount: 3,
    },
  });
  assert.equal(fullBudget.waveVisualMode, "multi-wave");
  assert.equal(fullBudget.primaryReason, "full_flow_budget");

  const budgetLimited = deriveFlowRenderDiagnostics({
    systemState: {
      activeMode: "flow",
      overlay: { visible: false },
      transition: { status: "idle", from: "flow", to: "flow" },
      flow: { state: "flow" },
      system: { performanceTier: "safe", renderProfile: "stable" },
    },
    runtimeProfile: {
      activeBudget: getPerformanceRenderBudget("safe", "stable"),
      activeTier: "safe",
      renderProfile: "stable",
    },
    canvasDebug: {
      desiredLayerCount: 3,
      layerCount: 1,
    },
  });
  assert.equal(budgetLimited.waveVisualMode, "single-wave");
  assert.equal(budgetLimited.primaryReason, "minimal_budget");
  assert.equal(budgetLimited.backgroundLayeringActive, false);
  assert.equal(budgetLimited.staticFlowBudget, false);
  assert.equal(budgetLimited.minimalFlowBudget, true);

  const transitionLimited = deriveFlowRenderDiagnostics({
    systemState: {
      activeMode: "flow",
      overlay: { visible: false },
      transition: { status: "animating", from: "listen", to: "flow" },
      flow: { state: "flow" },
      system: { performanceTier: "normal", renderProfile: "balanced" },
    },
    runtimeProfile: {
      activeBudget: getPerformanceRenderBudget("normal", "balanced"),
      activeTier: "normal",
      renderProfile: "balanced",
    },
    canvasDebug: {
      desiredLayerCount: 1,
      layerCount: 1,
    },
  });
  assert.equal(transitionLimited.appPhase, "transitioning");
  assert.equal(transitionLimited.primaryReason, "transition_phase");
  assert.equal(transitionLimited.backgroundLayeringActive, true);
});

test("performance trace summary recommends a device tier from real samples", () => {
  const summary = summarizePerformanceTrace([
    { avgFps: 60, interactionLatencyMs: 24, memoryUsageMb: 64 },
    { avgFps: 29, interactionLatencyMs: 48, memoryUsageMb: 72 },
    { avgFps: 23, interactionLatencyMs: 92, memoryUsageMb: 80 },
    { avgFps: 27, interactionLatencyMs: 54, memoryUsageMb: 76 },
  ]);

  assert.equal(summary.sampleCount, 4);
  assert.equal(summary.recommendedTier, "safe");
  assert.equal(summary.minFps, 23);
  assert.equal(summary.maxInteractionLatencyMs, 92);
  assert.equal(summary.reasons.includes("interaction_latency_above_80ms"), true);
});

console.log("Performance view model smoke tests passed.");
