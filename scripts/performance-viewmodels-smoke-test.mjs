import assert from "node:assert/strict";
import {
  derivePerformanceTierFromFps,
  getPerformanceDebugViewModel,
  getPerformanceRenderBudget,
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

  assert.equal(desktop.pixelRatioCap > balanced.pixelRatioCap, true);
  assert.equal(balanced.pixelRatioCap > stable.pixelRatioCap, true);
  assert.equal(desktop.maxWaveLayers > balanced.maxWaveLayers, true);
  assert.equal(balanced.particleMultiplier > stable.particleMultiplier, true);
});

test("frame window summary reports fps, latency, and optional memory", () => {
  const summary = summarizeFrameWindow({
    frames: 120,
    elapsedMs: 2000,
    maxFrameDeltaMs: 41.4,
    memory: {
      usedJSHeapSize: 32.4 * 1024 * 1024,
    },
  });

  assert.equal(summary.avgFps, 60);
  assert.equal(summary.interactionLatencyMs, 41);
  assert.equal(summary.memoryUsageMb, 32);
  assert.equal(summary.reason, "frontend_sampler");
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
  assert.equal(viewModel.budgetLabel.includes("particles 22%"), true);
  assert.equal(viewModel.tierDecisionReason, "pending_degrade_1/2");
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
