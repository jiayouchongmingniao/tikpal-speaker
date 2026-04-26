import fs from "node:fs";
import { execSync } from "node:child_process";
import { summarizePerformanceTrace } from "../src/viewmodels/performance.js";

function parseArgs(argv) {
  const args = {
    apiBase: process.env.TIKPAL_VALIDATION_API_BASE || "http://localhost:8787/api/v1/system",
    apiKey: process.env.TIKPAL_API_KEY || "",
    playerApiBase: process.env.TIKPAL_PLAYER_API_BASE || "",
    out: null,
    sample: false,
    exercisePortable: false,
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
    } else if (item === "--player-api-base") {
      args.playerApiBase = argv[index + 1] ?? args.playerApiBase;
      index += 1;
    } else if (item === "--sample") {
      args.sample = true;
    } else if (item === "--exercise-portable") {
      args.exercisePortable = true;
    }
  }

  args.apiBase = args.apiBase.replace(/\/+$/, "");
  args.playerApiBase = args.playerApiBase.replace(/\/+$/, "");
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

async function postJson(url, body = {}, { apiKey = "", bearerToken = "", timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-Tikpal-Key": apiKey } : {}),
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      body: JSON.stringify(body),
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

function redact(value) {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (/token|secret|authorization/i.test(key)) {
        return [key, entry ? "[redacted]" : entry];
      }
      return [key, redact(entry)];
    }),
  );
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
    integrations: {
      ok: true,
      status: 200,
      value: {
        items: {
          calendar: { connected: true, status: "ok", credentialRef: "local:calendar:sample" },
          todoist: { connected: true, status: "ok", credentialRef: "local:todoist:sample" },
        },
      },
    },
    portableBootstrap: {
      ok: true,
      status: 200,
      value: {
        ok: true,
        session: { role: "controller" },
      },
    },
    portableExercise: {
      pairing: { ok: true, status: 200, value: { code: "123456" } },
      claim: { ok: true, status: 200, value: { role: "controller", token: "[redacted]" } },
      action: { ok: true, status: 200, value: { result: "applied" } },
      voice: { ok: true, status: 200, value: { result: "applied" } },
    },
    playerStatus: {
      ok: true,
      status: 200,
      value: {
        state: "play",
        volume: 58,
        trackTitle: "Sample track",
      },
    },
    playerActions: {
      toggle_play: { ok: true, status: 200, value: { state: "pause" } },
      set_volume: { ok: true, status: 200, value: { volume: 72 } },
      next_track: { ok: true, status: 200, value: { trackTitle: "Next sample" } },
      prev_track: { ok: true, status: 200, value: { trackTitle: "Previous sample" } },
    },
  };
}

async function capturePortableExercise(apiBase, apiKey) {
  if (!apiKey) {
    return {
      skipped: "api key required",
    };
  }

  const pairing = await postJson(`${apiBase}/pairing-codes`, { role: "controller", ttlSec: 300 }, { apiKey });
  const claim = pairing.ok
    ? await postJson(
        `${apiBase}/pairing-codes/claim`,
        { code: pairing.value?.code, deviceId: "validation-capture", name: "Validation Capture" },
        {},
      )
    : { ok: false, status: null, error: "pairing failed" };
  const token = claim.value?.token ?? "";
  const action = token
    ? await postJson(
        `${apiBase}/actions`,
        { type: "set_mode", payload: { mode: "screen" }, source: "validation_capture" },
        { bearerToken: token },
      )
    : { ok: false, status: null, error: "claim token unavailable" };
  const voice = token
    ? await postJson(
        `${apiBase}/actions`,
        {
          type: "voice_capture_submit",
          payload: { transcript: "Validation capture voice sample.", moodLabel: "clear", moodIntensity: 0.5, careMode: "flow" },
          source: "validation_capture",
        },
        { bearerToken: token },
      )
    : { ok: false, status: null, error: "claim token unavailable" };

  return redact({
    pairing,
    claim,
    action,
    voice,
  });
}

async function capturePlayer(playerApiBase) {
  if (!playerApiBase) {
    return {
      playerStatus: { ok: false, status: null, error: "player api base not configured" },
      playerActions: {},
    };
  }

  const playerStatus = await fetchJson(`${playerApiBase}/status`, { timeoutMs: 2500 });
  const actions = {};
  for (const action of ["toggle_play", "set_volume", "next_track", "prev_track"]) {
    actions[action] = await postJson(
      `${playerApiBase}/actions`,
      action === "set_volume" ? { action, volume: 72 } : { action },
      { timeoutMs: 2500 },
    );
  }
  return {
    playerStatus,
    playerActions: actions,
  };
}

async function captureLive(args) {
  const { apiBase, apiKey } = args;
  const endpoints = {
    descriptor: `${apiBase}`,
    state: `${apiBase}/state`,
    screenContext: `${apiBase}/screen/context`,
    runtimeSummary: `${apiBase}/runtime/summary`,
    performanceSamples: `${apiBase}/runtime/performance-samples?limit=200`,
    otaStatus: `${apiBase}/ota/status`,
    integrations: `${apiBase}/integrations`,
    portableBootstrap: `${apiBase}/portable/bootstrap`,
  };
  const entries = await Promise.all(
    Object.entries(endpoints).map(async ([key, url]) => [key, await fetchJson(url, { apiKey })]),
  );
  const capture = Object.fromEntries(entries);
  const playerCapture = await capturePlayer(args.playerApiBase);
  return {
    ...capture,
    ...playerCapture,
    portableExercise: args.exercisePortable ? await capturePortableExercise(apiBase, apiKey) : { skipped: "use --exercise-portable" },
  };
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
  const integrationItems = capture.integrations?.value?.items ?? integrations;
  const playback = state.playback ?? {};
  const portableExercise = capture.portableExercise ?? {};
  const playerActions = capture.playerActions ?? {};

  return `# tikpal-speaker Target Device Validation Capture

## Version

| Item | Value |
| --- | --- |
| Captured at | ${new Date().toISOString()} |
| Git commit | ${gitCommit} |
| Git status | ${gitStatus || "clean"} |
| API base | ${args.apiBase} |
| Player API base | ${args.playerApiBase || "not configured"} |
| Sample mode | ${args.sample ? "yes" : "no"} |
| Portable exercise | ${args.exercisePortable ? "yes" : "no"} |

## Endpoint Status

| Endpoint | Result |
| --- | --- |
| descriptor | ${statusLabel(capture.descriptor)} |
| state | ${statusLabel(capture.state)} |
| screen context | ${statusLabel(capture.screenContext)} |
| runtime summary | ${statusLabel(capture.runtimeSummary)} |
| performance samples | ${statusLabel(capture.performanceSamples)} |
| OTA status | ${statusLabel(capture.otaStatus)} |
| integrations | ${statusLabel(capture.integrations)} |
| portable bootstrap | ${statusLabel(capture.portableBootstrap)} |
| player status | ${statusLabel(capture.playerStatus)} |

## Runtime Snapshot

| Item | Value |
| --- | --- |
| activeMode | ${state.activeMode ?? "n/a"} |
| performanceTier | ${state.system?.performanceTier ?? runtimeSummary.performanceTier ?? "n/a"} |
| playback | ${playback.trackTitle ?? "n/a"} / ${playback.state ?? "n/a"} / ${playback.volume ?? "n/a"} |
| playback source | ${playback.source ?? "n/a"} |
| Screen focus | ${screenContext.focusItem?.title ?? "n/a"} |
| Screen stale | ${screenContext.sync?.stale ?? "n/a"} |
| Calendar | ${integrationItems.calendar?.status ?? "n/a"} / ${integrationItems.calendar?.credentialRef ? "bound" : "unbound"} |
| Todoist | ${integrationItems.todoist?.status ?? "n/a"} / ${integrationItems.todoist?.credentialRef ? "bound" : "unbound"} |
| OTA current | ${ota.currentVersion ?? "n/a"} |
| OTA canRollback | ${ota.canRollback ?? "n/a"} |

## Player Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| status | ${statusLabel(capture.playerStatus)} | ${capture.playerStatus?.value?.trackTitle ?? capture.playerStatus?.error ?? "n/a"} |
| toggle_play | ${statusLabel(playerActions.toggle_play)} | ${playerActions.toggle_play?.value?.state ?? playerActions.toggle_play?.value?.playbackState ?? playerActions.toggle_play?.error ?? "n/a"} |
| set_volume | ${statusLabel(playerActions.set_volume)} | ${playerActions.set_volume?.value?.volume ?? playerActions.set_volume?.error ?? "n/a"} |
| next_track | ${statusLabel(playerActions.next_track)} | ${playerActions.next_track?.value?.trackTitle ?? playerActions.next_track?.error ?? "n/a"} |
| prev_track | ${statusLabel(playerActions.prev_track)} | ${playerActions.prev_track?.value?.trackTitle ?? playerActions.prev_track?.error ?? "n/a"} |

## Portable Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| bootstrap | ${statusLabel(capture.portableBootstrap)} | ${capture.portableBootstrap?.value?.session?.role ?? capture.portableBootstrap?.error ?? "n/a"} |
| pairing | ${statusLabel(portableExercise.pairing)} | ${portableExercise.skipped ?? portableExercise.pairing?.status ?? "n/a"} |
| claim | ${statusLabel(portableExercise.claim)} | ${portableExercise.claim?.value?.role ?? portableExercise.claim?.error ?? "n/a"} |
| controller action | ${statusLabel(portableExercise.action)} | ${portableExercise.action?.value?.result ?? portableExercise.action?.error ?? "n/a"} |
| voice capture | ${statusLabel(portableExercise.voice)} | ${portableExercise.voice?.value?.result ?? portableExercise.voice?.error ?? "n/a"} |

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
const capture = args.sample ? createSampleCapture() : await captureLive(args);
const report = renderReport({
  args,
  capture: redact(capture),
  gitCommit: safeExec("git rev-parse --short HEAD"),
  gitStatus: safeExec("git status --short").replace(/\n/g, "; "),
});

if (args.out) {
  fs.writeFileSync(args.out, report);
}

console.log(report);
