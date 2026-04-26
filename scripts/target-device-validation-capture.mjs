import fs from "node:fs";
import { execSync } from "node:child_process";
import { summarizePerformanceTrace } from "../src/viewmodels/performance.js";

function parseArgs(argv) {
  const args = {
    apiBase: process.env.TIKPAL_VALIDATION_API_BASE || "http://localhost:8787/api/v1/system",
    apiKey: process.env.TIKPAL_API_KEY || "",
    out: null,
    sample: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--api-base") {
      args.apiBase = argv[index + 1] ?? args.apiBase;
      index += 1;
    } else if (item === "--api-key") {
      args.apiKey = argv[index + 1] ?? args.apiKey;
      index += 1;
    } else if (item === "--out") {
      args.out = argv[index + 1] ?? args.out;
      index += 1;
    } else if (item === "--sample") {
      args.sample = true;
    }
  }

  args.apiBase = args.apiBase.replace(/\/+$/, "");
  return args;
}

function safeExec(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unavailable";
  }
}

async function fetchJson(url, { apiKey = "", timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        ...(apiKey ? { "X-Tikpal-Key": apiKey } : {}),
      },
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      value: text ? JSON.parse(text) : null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function createSampleCapture() {
  return {
    descriptor: {
      ok: true,
      status: 200,
      value: {
        service: "tikpal-speaker-system-api",
      },
    },
    state: {
      ok: true,
      status: 200,
      value: {
        activeMode: "overview",
        playback: {
          state: "play",
          volume: 58,
          trackTitle: "Sample track",
          source: "moOde",
        },
        system: {
          performanceTier: "reduced",
          ota: {
            currentVersion: "0.1.0",
            updateAvailable: false,
          },
        },
        integrations: {
          calendar: { connected: true, status: "ok" },
          todoist: { connected: true, status: "ok" },
        },
      },
    },
    screenContext: {
      ok: true,
      status: 200,
      value: {
        focusItem: { title: "Sample focus" },
        sync: { stale: false },
      },
    },
    runtimeSummary: {
      ok: true,
      status: 200,
      value: {
        performanceTier: "reduced",
        avgFps: 28,
        interactionLatencyMs: 42,
      },
    },
    performanceSamples: {
      ok: true,
      status: 200,
      value: {
        items: [
          { avgFps: 31, interactionLatencyMs: 38, memoryUsageMb: 96, activeMode: "flow" },
          { avgFps: 28, interactionLatencyMs: 44, memoryUsageMb: 98, activeMode: "flow" },
          { avgFps: 25, interactionLatencyMs: 52, memoryUsageMb: 102, activeMode: "flow" },
        ],
      },
    },
    otaStatus: {
      ok: true,
      status: 200,
      value: {
        currentVersion: "0.1.0",
        canRollback: false,
        lastOperation: null,
      },
    },
  };
}

async function captureLive(apiBase, apiKey) {
  const endpoints = {
    descriptor: `${apiBase}`,
    state: `${apiBase}/state`,
    screenContext: `${apiBase}/screen/context`,
    runtimeSummary: `${apiBase}/runtime/summary`,
    performanceSamples: `${apiBase}/runtime/performance-samples?limit=200`,
    otaStatus: `${apiBase}/ota/status`,
  };
  const entries = await Promise.all(
    Object.entries(endpoints).map(async ([key, url]) => [key, await fetchJson(url, { apiKey })]),
  );
  return Object.fromEntries(entries);
}

function statusLabel(result) {
  if (!result) {
    return "missing";
  }

  return result.ok ? `ok ${result.status}` : result.status ? `error ${result.status}` : "unreachable";
}

function renderReport({ args, capture, gitCommit, gitStatus }) {
  const state = capture.state?.value ?? {};
  const runtimeSummary = capture.runtimeSummary?.value ?? {};
  const samples = capture.performanceSamples?.value?.items ?? [];
  const performanceTrace = summarizePerformanceTrace(samples);
  const screenContext = capture.screenContext?.value ?? {};
  const ota = capture.otaStatus?.value ?? state.system?.ota ?? {};
  const integrations = state.integrations ?? {};
  const playback = state.playback ?? {};

  return `# tikpal-speaker Target Device Validation Capture

## Version

| Item | Value |
| --- | --- |
| Captured at | ${new Date().toISOString()} |
| Git commit | ${gitCommit} |
| Git status | ${gitStatus || "clean"} |
| API base | ${args.apiBase} |
| Sample mode | ${args.sample ? "yes" : "no"} |

## Endpoint Status

| Endpoint | Result |
| --- | --- |
| descriptor | ${statusLabel(capture.descriptor)} |
| state | ${statusLabel(capture.state)} |
| screen context | ${statusLabel(capture.screenContext)} |
| runtime summary | ${statusLabel(capture.runtimeSummary)} |
| performance samples | ${statusLabel(capture.performanceSamples)} |
| OTA status | ${statusLabel(capture.otaStatus)} |

## Runtime Snapshot

| Item | Value |
| --- | --- |
| activeMode | ${state.activeMode ?? "n/a"} |
| performanceTier | ${state.system?.performanceTier ?? runtimeSummary.performanceTier ?? "n/a"} |
| playback | ${playback.trackTitle ?? "n/a"} / ${playback.state ?? "n/a"} / ${playback.volume ?? "n/a"} |
| playback source | ${playback.source ?? "n/a"} |
| Screen focus | ${screenContext.focusItem?.title ?? "n/a"} |
| Screen stale | ${screenContext.sync?.stale ?? "n/a"} |
| Calendar | ${integrations.calendar?.status ?? "n/a"} |
| Todoist | ${integrations.todoist?.status ?? "n/a"} |
| OTA current | ${ota.currentVersion ?? "n/a"} |
| OTA canRollback | ${ota.canRollback ?? "n/a"} |

## Performance Trace

| Metric | Value |
| --- | --- |
| sampleCount | ${performanceTrace.sampleCount} |
| avgFps | ${performanceTrace.avgFps ?? "n/a"} |
| p10Fps | ${performanceTrace.p10Fps ?? "n/a"} |
| minFps | ${performanceTrace.minFps ?? "n/a"} |
| maxInteractionLatencyMs | ${performanceTrace.maxInteractionLatencyMs ?? "n/a"} |
| maxMemoryUsageMb | ${performanceTrace.maxMemoryUsageMb ?? "n/a"} |
| recommendedTier | ${performanceTrace.recommendedTier} |
| reasons | ${performanceTrace.reasons.join(", ") || "none"} |

## Validation Notes

| Area | Pass / Fail | Evidence |
| --- | --- | --- |
| real Screen integrations |  |  |
| real player |  |  |
| performance degradation |  |  |
| OTA |  |  |
| portable end-to-end loop |  |  |
`;
}

const args = parseArgs(process.argv.slice(2));
const capture = args.sample ? createSampleCapture() : await captureLive(args.apiBase, args.apiKey);
const report = renderReport({
  args,
  capture,
  gitCommit: safeExec("git rev-parse --short HEAD"),
  gitStatus: safeExec("git status --short").replace(/\n/g, "; "),
});

if (args.out) {
  fs.writeFileSync(args.out, report);
}

console.log(report);
