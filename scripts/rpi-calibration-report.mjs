import fs from "node:fs";
import { execSync } from "node:child_process";
import { summarizePerformanceTrace } from "../src/viewmodels/performance.js";

const DEFAULT_SWITCHES_PER_10_MIN_LIMIT = 6;
const TARGET_P10_FPS = 30;

function parseArgs(argv) {
  const args = {
    date: new Date().toISOString().slice(0, 10),
    device: "Raspberry Pi 4",
    profile: process.env.RPI_RENDER_PROFILE || "balanced",
    operator: process.env.USER || "unknown",
    commit: "",
    apiBase: "http://localhost:8787/api/v1/system",
    uiBase: "http://localhost:4173",
    scenarioLoop: "",
    scenarioFlow: "",
    scenarioMixed: "",
    soak: "",
    out: "",
    switchesPer10MinLimit: DEFAULT_SWITCHES_PER_10_MIN_LIMIT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--date") {
      args.date = argv[index + 1] ?? args.date;
      index += 1;
    } else if (item === "--device") {
      args.device = argv[index + 1] ?? args.device;
      index += 1;
    } else if (item === "--profile") {
      args.profile = argv[index + 1] ?? args.profile;
      index += 1;
    } else if (item === "--operator") {
      args.operator = argv[index + 1] ?? args.operator;
      index += 1;
    } else if (item === "--commit") {
      args.commit = argv[index + 1] ?? args.commit;
      index += 1;
    } else if (item === "--api-base") {
      args.apiBase = argv[index + 1] ?? args.apiBase;
      index += 1;
    } else if (item === "--ui-base") {
      args.uiBase = argv[index + 1] ?? args.uiBase;
      index += 1;
    } else if (item === "--scenario-loop") {
      args.scenarioLoop = argv[index + 1] ?? args.scenarioLoop;
      index += 1;
    } else if (item === "--scenario-flow") {
      args.scenarioFlow = argv[index + 1] ?? args.scenarioFlow;
      index += 1;
    } else if (item === "--scenario-mixed") {
      args.scenarioMixed = argv[index + 1] ?? args.scenarioMixed;
      index += 1;
    } else if (item === "--soak") {
      args.soak = argv[index + 1] ?? args.soak;
      index += 1;
    } else if (item === "--out") {
      args.out = argv[index + 1] ?? args.out;
      index += 1;
    } else if (item === "--switches-per-10m-limit") {
      args.switchesPer10MinLimit = Number(argv[index + 1] ?? args.switchesPer10MinLimit);
      index += 1;
    }
  }

  args.apiBase = String(args.apiBase).replace(/\/+$/, "");
  args.uiBase = String(args.uiBase).replace(/\/+$/, "");
  return args;
}

function safeExec(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unavailable";
  }
}

function readSamples(filePath) {
  if (!filePath) {
    return [];
  }
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(payload)) {
    return payload;
  }
  return Array.isArray(payload.items) ? payload.items : [];
}

function toTimestampMs(sample) {
  if (!sample || !sample.timestamp) {
    return null;
  }
  const value = new Date(sample.timestamp).getTime();
  return Number.isFinite(value) ? value : null;
}

function normalizeTier(tier) {
  return tier === "safe" || tier === "reduced" || tier === "normal" ? tier : null;
}

function summarizeTierStability(samples) {
  const withTier = samples
    .map((sample) => ({
      timestampMs: toTimestampMs(sample),
      tier: normalizeTier(sample?.tier),
    }))
    .filter((sample) => sample.tier);

  if (!withTier.length) {
    return {
      switchCount: 0,
      durationMin: null,
      switchesPer10Min: null,
      latestTier: null,
    };
  }

  const ordered = withTier.every((item) => item.timestampMs !== null)
    ? [...withTier].sort((a, b) => a.timestampMs - b.timestampMs)
    : withTier;
  let switchCount = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].tier !== ordered[index - 1].tier) {
      switchCount += 1;
    }
  }

  const first = ordered[0].timestampMs;
  const last = ordered[ordered.length - 1].timestampMs;
  const durationMin = first !== null && last !== null && last > first ? (last - first) / 60000 : null;
  const switchesPer10Min = durationMin && durationMin > 0 ? (switchCount / durationMin) * 10 : null;

  return {
    switchCount,
    durationMin,
    switchesPer10Min,
    latestTier: ordered[ordered.length - 1].tier,
  };
}

function summarizeScenario(name, samples, switchesPer10MinLimit) {
  const trace = summarizePerformanceTrace(samples);
  const stability = summarizeTierStability(samples);
  const performancePass = typeof trace.p10Fps === "number" && trace.p10Fps >= TARGET_P10_FPS;
  const stabilityPass =
    stability.switchesPer10Min === null ? true : stability.switchesPer10Min <= switchesPer10MinLimit;

  return {
    name,
    sampleCount: trace.sampleCount,
    avgFps: trace.avgFps,
    p10Fps: trace.p10Fps,
    minFps: trace.minFps,
    maxInteractionLatencyMs: trace.maxInteractionLatencyMs,
    maxMemoryUsageMb: trace.maxMemoryUsageMb,
    recommendedTier: trace.recommendedTier,
    reasons: trace.reasons,
    switchCount: stability.switchCount,
    durationMin: stability.durationMin,
    switchesPer10Min: stability.switchesPer10Min,
    latestTier: stability.latestTier,
    performancePass,
    stabilityPass,
  };
}

function formatNumber(value, digits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }
  return String(Math.round(value * 10 ** digits) / 10 ** digits);
}

function statusLabel(value) {
  return value ? "PASS" : "FAIL";
}

function renderScenarioRow(item) {
  return `| ${item.name} | ${item.sampleCount} | ${formatNumber(item.avgFps)} | ${formatNumber(item.p10Fps)} | ${formatNumber(item.maxInteractionLatencyMs, 0)} | ${item.recommendedTier} | ${formatNumber(item.switchesPer10Min)} | ${statusLabel(item.performancePass && item.stabilityPass)} |`;
}

function renderReport(args, scenarios, soakScenario) {
  const commit = args.commit || safeExec("git rev-parse --short HEAD");
  const gpuPocGateByData = scenarios.some((item) => typeof item.p10Fps === "number" && item.p10Fps < TARGET_P10_FPS);
  const allScenarioPass = scenarios.every((item) => item.performancePass && item.stabilityPass);
  const soakPass = soakScenario ? soakScenario.performancePass && soakScenario.stabilityPass : null;
  const releaseGatePass = allScenarioPass && (soakPass === null ? true : soakPass);

  return `# Raspberry Pi Calibration Report

## Session

| Item | Value |
| --- | --- |
| Date | ${args.date} |
| Device | ${args.device} |
| Commit | ${commit} |
| Operator | ${args.operator} |
| Render profile | ${args.profile} |
| API URL | ${args.apiBase} |
| UI URL | ${args.uiBase} |
| Tier switch limit | <= ${args.switchesPer10MinLimit} per 10 min |

## Scenario Summary (5 min each)

| Scenario | Samples | avgFps | p10Fps | max latency ms | recommendedTier | switches/10m | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
${scenarios.map(renderScenarioRow).join("\n")}

## 30 min Soak (optional)

| Check | Value |
| --- | --- |
| Included | ${soakScenario ? "yes" : "no"} |
| Samples | ${soakScenario ? soakScenario.sampleCount : "n/a"} |
| avgFps | ${soakScenario ? formatNumber(soakScenario.avgFps) : "n/a"} |
| p10Fps | ${soakScenario ? formatNumber(soakScenario.p10Fps) : "n/a"} |
| max latency ms | ${soakScenario ? formatNumber(soakScenario.maxInteractionLatencyMs, 0) : "n/a"} |
| switches/10m | ${soakScenario ? formatNumber(soakScenario.switchesPer10Min) : "n/a"} |
| Result | ${soakScenario ? statusLabel(soakScenario.performancePass && soakScenario.stabilityPass) : "n/a"} |

## Acceptance Decision

| Gate | Result | Notes |
| --- | --- | --- |
| Performance (p10Fps >= ${TARGET_P10_FPS}) | ${statusLabel(scenarios.every((item) => item.performancePass))} | Scenario-level automatic check |
| Stability (tier switches controlled) | ${statusLabel(scenarios.every((item) => item.stabilityPass))} | Uses configured switch limit |
| 30 min soak | ${soakPass === null ? "SKIPPED" : statusLabel(soakPass)} | Recommended before release |
| Visual no-flicker (manual) | TODO | Confirm no white/brightness flash while switching modes |
| Interaction continuity (manual) | TODO | Confirm flow playback and screen pomodoro remain responsive |

## GPU PoC Gate

| Condition | Result |
| --- | --- |
| A) Visible flicker still exists (manual) | TODO |
| B) Data gate: p10Fps < ${TARGET_P10_FPS} or severe transition instability | ${statusLabel(gpuPocGateByData)} |
| C) Critical interaction frame drops unacceptable (manual) | TODO |

## Recommendation

${releaseGatePass ? "- Keep current WebGL path as the release candidate while preserving Canvas fallback and native GPU evidence." : "- Hold release and continue WebGL/native GPU PoC comparison before treating the current path as shippable."}
${gpuPocGateByData ? "- GPU PoC gate B is triggered by current data. Run both Flow WebGL and native X11/EGL/GLES lanes at the same physical output." : "- GPU PoC remains a parallel validation lane unless manual gates A/C are triggered."}
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scenarioInputs = [
    ["overview-flow-screen-loop", args.scenarioLoop],
    ["flow-soak-5m", args.scenarioFlow],
    ["mixed-interaction-5m", args.scenarioMixed],
  ];
  const missing = scenarioInputs.filter(([, filePath]) => !filePath);
  if (missing.length) {
    console.error("Missing required scenario files.");
    console.error("Provide --scenario-loop, --scenario-flow, and --scenario-mixed.");
    process.exit(1);
  }

  const scenarios = scenarioInputs.map(([name, filePath]) =>
    summarizeScenario(name, readSamples(filePath), args.switchesPer10MinLimit),
  );
  const soakScenario = args.soak
    ? summarizeScenario("long-soak-30m", readSamples(args.soak), args.switchesPer10MinLimit)
    : null;
  const report = renderReport(args, scenarios, soakScenario);

  if (args.out) {
    fs.writeFileSync(args.out, report);
  }

  console.log(report);
}

main();
