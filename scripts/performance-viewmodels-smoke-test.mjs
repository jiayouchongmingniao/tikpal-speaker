import assert from "node:assert/strict";
import {
  derivePerformanceTierFromFps,
  getPerformanceDebugViewModel,
  getPerformanceRenderBudget,
  summarizeFrameWindow,
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
  assert.deepEqual(getPerformanceRenderBudget("unknown"), normal);
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
      performance: {
        avgFps: 28,
        interactionLatencyMs: 38,
        memoryUsageMb: 96,
        lastDegradeReason: "fps",
      },
    },
  });

  assert.equal(viewModel.tier, "reduced");
  assert.equal(viewModel.suggestedTier, "reduced");
  assert.equal(viewModel.budget.maxWaveLayers, 2);
  assert.equal(viewModel.budgetLabel.includes("particles 55%"), true);
});

console.log("Performance view model smoke tests passed.");
