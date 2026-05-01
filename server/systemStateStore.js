import {
  applyFlowSceneToPlayback,
  createDefaultFlowScenesByState,
  createFlowSceneState,
  getFlowSceneById,
  getFlowScenesForState,
  getNextFlowSceneSelection,
  normalizeFlowScenesByState,
  normalizeFlowState,
  resolveFlowSceneSelection,
} from "../src/viewmodels/flowScenes.js";

const MODE_ORDER = ["listen", "flow", "screen"];
const FLOW_ORDER = ["focus", "flow", "relax", "sleep"];
const CREATIVE_CARE_MOODS = ["clear", "scattered", "stuck", "tired", "calm", "energized"];
const CREATIVE_CARE_MODES = ["focus", "flow", "unwind", "sleep"];
const MODE_TRANSITION_MS = 5000;
const FLOW_TRANSITION_MS = 5000;
const ROLE_ORDER = ["viewer", "controller", "operator", "admin"];
const MAX_RUNTIME_LOG_ENTRIES = 200;
const DEFAULT_SESSION_TTL_SEC = 24 * 60 * 60;
const MAX_SESSION_TTL_SEC = 7 * 24 * 60 * 60;
const DEFAULT_PAIRING_TTL_SEC = 5 * 60;
const MAX_PAIRING_TTL_SEC = 30 * 60;
const ROLE_SCOPES = {
  viewer: ["state:read", "capabilities:read"],
  controller: ["state:read", "capabilities:read", "actions:control"],
  operator: ["state:read", "capabilities:read", "actions:control", "runtime:debug"],
  admin: ["state:read", "capabilities:read", "actions:control", "runtime:debug", "ota:manage", "sessions:manage"],
};
const ACTION_ROLE_REQUIREMENTS = {
  set_mode: "controller",
  return_overview: "controller",
  focus_panel: "controller",
  next_mode: "controller",
  prev_mode: "controller",
  show_controls: "controller",
  hide_controls: "controller",
  toggle_play: "controller",
  prev_track: "controller",
  next_track: "controller",
  set_volume: "controller",
  set_flow_state: "controller",
  next_flow_scene: "controller",
  prev_flow_scene: "controller",
  set_flow_scene: "controller",
  screen_start_pomodoro: "controller",
  screen_resume_pomodoro: "controller",
  screen_pause_pomodoro: "controller",
  screen_reset_pomodoro: "controller",
  screen_complete_current_task: "controller",
  screen_set_focus_item: "controller",
  voice_capture_submit: "controller",
  voice_mood_set: "controller",
  voice_care_mode_set: "controller",
  voice_reflection_clear: "controller",
  runtime_set_performance_tier: "operator",
  runtime_report_performance: "operator",
  ota_check: "admin",
  ota_apply: "admin",
  ota_rollback: "admin",
  system_reboot: "admin",
  system_shutdown: "admin",
};
const CONNECTOR_NAMES = ["calendar", "todoist"];
const MOCK_QUEUE = [
  {
    trackTitle: "Low Light Corridor",
    artist: "tikpal",
    album: "Mock Session",
    source: "Mock Stream",
    progress: 0.63,
    format: "FLAC 24/96",
    nextTrackTitle: "Night Window",
  },
  {
    trackTitle: "Night Window",
    artist: "tikpal",
    album: "Mock Session",
    source: "Mock Stream",
    progress: 0.14,
    format: "FLAC 24/96",
    nextTrackTitle: "Signal Bloom",
  },
  {
    trackTitle: "Signal Bloom",
    artist: "tikpal",
    album: "Mock Session",
    source: "Mock Stream",
    progress: 0.41,
    format: "FLAC 24/96",
    nextTrackTitle: "Low Light Corridor",
  },
];
const PERSISTENCE_VERSION = 1;
const OTA_OPERATIONAL_ERROR_CODES = new Set([
  "OTA_RELEASE_NOT_FOUND",
  "OTA_MANIFEST_MISSING",
  "OTA_MANIFEST_INVALID",
  "OTA_RESTART_FAILED",
  "OTA_HEALTH_CHECK_FAILED",
]);
const PERFORMANCE_TIERS = ["normal", "reduced", "safe"];
const PERFORMANCE_POLICY = {
  degradeWindows: 2,
  upgradeWindows: 6,
  cooldownMs: 30_000,
  degradeThresholds: {
    normal: 30,
    reduced: 30,
  },
  upgradeThresholds: {
    safe: 32,
    reduced: 36,
  },
};
const BASE_RENDER_BUDGETS = {
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
const PI4_TARGET_FRAME_INTERVAL_MS = 33;
const RPI_RENDER_PROFILE_BUDGET_OVERRIDES = {
  balanced: {
    normal: {
      pixelRatioCap: 1.2,
      renderScale: 0.82,
      webglRenderScale: 0.4,
      waveStep: 26,
      maxWaveLayers: 3,
      particleMultiplier: 0.42,
      frameIntervalMs: PI4_TARGET_FRAME_INTERVAL_MS,
      flowSceneMode: "animated",
    },
    reduced: {
      pixelRatioCap: 0.9,
      renderScale: 0.5,
      webglRenderScale: 0.28,
      waveStep: 46,
      maxWaveLayers: 2,
      particleMultiplier: 0.12,
      frameIntervalMs: PI4_TARGET_FRAME_INTERVAL_MS,
      flowSceneMode: "animated",
    },
    safe: {
      pixelRatioCap: 0.56,
      renderScale: 0.28,
      webglRenderScale: 0.18,
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
      webglRenderScale: 0.32,
      waveStep: 40,
      maxWaveLayers: 2,
      particleMultiplier: 0.16,
      frameIntervalMs: PI4_TARGET_FRAME_INTERVAL_MS,
      flowSceneMode: "animated",
    },
    reduced: {
      pixelRatioCap: 0.62,
      renderScale: 0.36,
      webglRenderScale: 0.22,
      waveStep: 80,
      maxWaveLayers: 1,
      particleMultiplier: 0.04,
      frameIntervalMs: PI4_TARGET_FRAME_INTERVAL_MS,
      flowSceneMode: "minimal",
    },
    safe: {
      pixelRatioCap: 0.45,
      renderScale: 0.2,
      webglRenderScale: 0.16,
      waveStep: 132,
      maxWaveLayers: 1,
      particleMultiplier: 0,
      frameIntervalMs: PI4_TARGET_FRAME_INTERVAL_MS,
      flowSceneMode: "minimal",
    },
  },
};

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizePerformanceTier(tier = "normal") {
  return PERFORMANCE_TIERS.includes(tier) ? tier : "normal";
}

function normalizeFlowDiagnosticMode(mode = "off") {
  return mode === "static" ? "static" : "off";
}

function normalizeRenderProfile(profile = "off") {
  return profile === "balanced" || profile === "stable" ? profile : "off";
}

function createPerformancePolicySnapshot() {
  return {
    degradeWindows: PERFORMANCE_POLICY.degradeWindows,
    upgradeWindows: PERFORMANCE_POLICY.upgradeWindows,
    cooldownMs: PERFORMANCE_POLICY.cooldownMs,
    degradeThresholds: { ...PERFORMANCE_POLICY.degradeThresholds },
    upgradeThresholds: { ...PERFORMANCE_POLICY.upgradeThresholds },
  };
}

function getRenderBudgetForTier(tier = "normal", renderProfile = "off") {
  const normalizedTier = normalizePerformanceTier(tier);
  const normalizedProfile = normalizeRenderProfile(renderProfile);
  const base = BASE_RENDER_BUDGETS[normalizedTier];
  if (normalizedProfile === "off") {
    return base;
  }
  return {
    ...base,
    ...(RPI_RENDER_PROFILE_BUDGET_OVERRIDES[normalizedProfile]?.[normalizedTier] ?? {}),
  };
}

function getRuntimeProfileConfig(renderProfile = "off", activeTier = "normal") {
  const normalizedProfile = normalizeRenderProfile(renderProfile);
  const tiers = {};
  for (const tier of PERFORMANCE_TIERS) {
    tiers[tier] = getRenderBudgetForTier(tier, normalizedProfile);
  }
  return {
    renderProfile: normalizedProfile,
    activeTier: normalizePerformanceTier(activeTier),
    activeBudget: tiers[normalizePerformanceTier(activeTier)],
    tiers,
    tierPolicy: createPerformancePolicySnapshot(),
  };
}

function createInitialPerformanceState() {
  return {
    avgFps: 60,
    temperatureC: null,
    interactionLatencyMs: null,
    memoryUsageMb: null,
    lastDegradeReason: null,
    rendererType: "image",
    requestedRenderer: "image",
    chromiumExperiment: "baseline",
    rendererFallbackCount: 0,
    glInitErrorCount: 0,
    glContextLostCount: 0,
    rendererFallbackReason: null,
    tierDecisionReason: "boot_default",
    tierCooldownUntil: null,
    tierCooldownRemainingMs: 0,
    performanceTierUpdatedAt: nowIso(),
    belowThresholdCount: 0,
    aboveThresholdCount: 0,
    updatedAt: nowIso(),
  };
}

function deriveTierDecision({ avgFps, payloadTier, liveState, policy, nowMs }) {
  const currentTier = normalizePerformanceTier(liveState.system.performanceTier);
  const performanceState = liveState.system.performance ?? {};
  const cooldownUntil = Number(performanceState.tierCooldownUntil ?? 0) || 0;
  const cooldownRemainingMs = Math.max(0, cooldownUntil - nowMs);
  const nextFromPayload = normalizePerformanceTier(payloadTier);
  const hasPayloadTier = payloadTier && PERFORMANCE_TIERS.includes(payloadTier);
  let nextTier = currentTier;
  let decisionReason = "hold";
  let belowThresholdCount = Number(performanceState.belowThresholdCount ?? 0) || 0;
  let aboveThresholdCount = Number(performanceState.aboveThresholdCount ?? 0) || 0;
  let tierUpdatedAt = performanceState.performanceTierUpdatedAt ?? null;
  let tierCooldownUntil = performanceState.tierCooldownUntil ?? null;

  if (hasPayloadTier && nextFromPayload !== currentTier) {
    nextTier = nextFromPayload;
    decisionReason = "payload_tier_override";
    belowThresholdCount = 0;
    aboveThresholdCount = 0;
    tierUpdatedAt = nowIso();
    tierCooldownUntil = nowMs + policy.cooldownMs;
    return {
      nextTier,
      tierChanged: true,
      decisionReason,
      belowThresholdCount,
      aboveThresholdCount,
      tierCooldownUntil,
      tierCooldownRemainingMs: policy.cooldownMs,
      performanceTierUpdatedAt: tierUpdatedAt,
    };
  }

  if (!Number.isFinite(avgFps)) {
    return {
      nextTier,
      tierChanged: false,
      decisionReason: "hold_no_fps_sample",
      belowThresholdCount: 0,
      aboveThresholdCount: 0,
      tierCooldownUntil,
      tierCooldownRemainingMs: cooldownRemainingMs,
      performanceTierUpdatedAt: tierUpdatedAt,
    };
  }

  const degradeThreshold = policy.degradeThresholds[currentTier];
  const upgradeThreshold = policy.upgradeThresholds[currentTier];
  const degradeCandidate = currentTier === "normal" ? "reduced" : currentTier === "reduced" ? "safe" : "safe";
  const upgradeCandidate = currentTier === "safe" ? "reduced" : currentTier === "reduced" ? "normal" : "normal";

  if (degradeThreshold !== undefined && avgFps < degradeThreshold) {
    belowThresholdCount += 1;
    aboveThresholdCount = 0;
    if (belowThresholdCount >= policy.degradeWindows) {
      nextTier = degradeCandidate;
      decisionReason = `degrade_fps_below_${degradeThreshold}_x${policy.degradeWindows}`;
      belowThresholdCount = 0;
      tierUpdatedAt = nowIso();
      tierCooldownUntil = nowMs + policy.cooldownMs;
      return {
        nextTier,
        tierChanged: true,
        decisionReason,
        belowThresholdCount,
        aboveThresholdCount,
        tierCooldownUntil,
        tierCooldownRemainingMs: policy.cooldownMs,
        performanceTierUpdatedAt: tierUpdatedAt,
      };
    }

    return {
      nextTier,
      tierChanged: false,
      decisionReason: `pending_degrade_${belowThresholdCount}/${policy.degradeWindows}`,
      belowThresholdCount,
      aboveThresholdCount,
      tierCooldownUntil,
      tierCooldownRemainingMs: cooldownRemainingMs,
      performanceTierUpdatedAt: tierUpdatedAt,
    };
  }

  belowThresholdCount = 0;

  if (upgradeThreshold !== undefined && avgFps >= upgradeThreshold) {
    aboveThresholdCount += 1;
    if (cooldownRemainingMs > 0) {
      return {
        nextTier,
        tierChanged: false,
        decisionReason: "hold_upgrade_cooldown",
        belowThresholdCount,
        aboveThresholdCount,
        tierCooldownUntil,
        tierCooldownRemainingMs: cooldownRemainingMs,
        performanceTierUpdatedAt: tierUpdatedAt,
      };
    }

    if (aboveThresholdCount >= policy.upgradeWindows) {
      nextTier = upgradeCandidate;
      decisionReason = `upgrade_fps_above_${upgradeThreshold}_x${policy.upgradeWindows}`;
      aboveThresholdCount = 0;
      tierUpdatedAt = nowIso();
      tierCooldownUntil = nowMs + policy.cooldownMs;
      return {
        nextTier,
        tierChanged: true,
        decisionReason,
        belowThresholdCount,
        aboveThresholdCount,
        tierCooldownUntil,
        tierCooldownRemainingMs: policy.cooldownMs,
        performanceTierUpdatedAt: tierUpdatedAt,
      };
    }

    return {
      nextTier,
      tierChanged: false,
      decisionReason: `pending_upgrade_${aboveThresholdCount}/${policy.upgradeWindows}`,
      belowThresholdCount,
      aboveThresholdCount,
      tierCooldownUntil,
      tierCooldownRemainingMs: 0,
      performanceTierUpdatedAt: tierUpdatedAt,
    };
  }

  aboveThresholdCount = 0;
  return {
    nextTier,
    tierChanged: false,
    decisionReason: "hold_within_band",
    belowThresholdCount,
    aboveThresholdCount,
    tierCooldownUntil,
    tierCooldownRemainingMs: cooldownRemainingMs,
    performanceTierUpdatedAt: tierUpdatedAt,
  };
}

function createSessionToken() {
  return `sess_${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 8)}`;
}

function createPairingCodeValue() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeRole(role = "controller") {
  return ROLE_ORDER.includes(role) ? role : "controller";
}

function hasRequiredRole(role, requiredRole = "viewer") {
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(requiredRole);
}

function getQueueTrack(index) {
  return MOCK_QUEUE[(index + MOCK_QUEUE.length) % MOCK_QUEUE.length];
}

function mergePlayerState(playback, playerState = {}) {
  if (!playerState || typeof playerState !== "object") {
    return playback;
  }

  const has = (key) => Object.prototype.hasOwnProperty.call(playerState, key);

  return {
    ...playback,
    state: has("state") ? playerState.state : has("playbackState") ? playerState.playbackState : playback.state,
    volume: has("volume") ? playerState.volume : playback.volume,
    trackTitle: has("trackTitle") ? playerState.trackTitle : has("title") ? playerState.title : playback.trackTitle,
    artist: has("artist") ? playerState.artist : playback.artist,
    album: has("album") ? playerState.album : playback.album,
    source: has("source") ? playerState.source : playback.source,
    progress: has("progress") ? playerState.progress : playback.progress,
    durationSec: has("durationSec") ? playerState.durationSec : playback.durationSec,
    format: has("format") ? playerState.format : playback.format,
    sampleRate: has("sampleRate") ? playerState.sampleRate : playback.sampleRate,
    bitDepth: has("bitDepth") ? playerState.bitDepth : playback.bitDepth,
    nextTrackTitle: has("nextTrackTitle") ? playerState.nextTrackTitle : playback.nextTrackTitle,
    currentTrackIndex: has("currentTrackIndex") ? playerState.currentTrackIndex : playback.currentTrackIndex,
    queueLength: has("queueLength") ? playerState.queueLength : playback.queueLength,
  };
}

function getDefaultCreativeCare() {
  return {
    latestTranscript: "",
    moodLabel: "clear",
    moodIntensity: 0.45,
    inspirationSummary: "Ready for a fresh creative session.",
    suggestedFlowState: "flow",
    currentCareMode: "flow",
    insightSentence: "Start with one clear thought, then let the session find its shape.",
    updatedAt: null,
    metadata: {
      source: "system",
      captureLength: 0,
    },
  };
}

function normalizeMoodLabel(value, fallback = "clear") {
  return CREATIVE_CARE_MOODS.includes(value) ? value : fallback;
}

function normalizeCareMode(value, fallback = "flow") {
  return CREATIVE_CARE_MODES.includes(value) ? value : fallback;
}

function deriveCareModeFromMood(moodLabel) {
  if (moodLabel === "clear" || moodLabel === "energized") {
    return "flow";
  }

  if (moodLabel === "scattered" || moodLabel === "stuck") {
    return "focus";
  }

  return "unwind";
}

function deriveFlowStateFromCareMode(careMode) {
  if (careMode === "sleep") {
    return "sleep";
  }

  if (careMode === "unwind") {
    return "relax";
  }

  return careMode === "flow" ? "flow" : "focus";
}

function normalizeFlowSurface(flow = {}) {
  const nextState = normalizeFlowState(flow.state ?? "focus");
  const sceneSelection = resolveFlowSceneSelection({
    flowState: nextState,
    sceneId: flow.sceneId,
    sceneIndex: flow.sceneIndex,
    scenesByState: flow.scenesByState ?? createDefaultFlowScenesByState(),
  });

  return {
    ...flow,
    state: nextState,
    subtitle: deriveFlowSubtitle(nextState),
    sceneId: sceneSelection.sceneId,
    sceneIndex: sceneSelection.sceneIndex,
    scenesByState: sceneSelection.scenesByState,
  };
}

function createInsightSentence(transcript, fallback) {
  const normalized = String(transcript ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback ?? getDefaultCreativeCare().insightSentence;
  }

  const [firstSentence] = normalized.split(/(?<=[.!?])\s+/);
  const sentence = firstSentence || normalized;
  return sentence.length > 132 ? `${sentence.slice(0, 129).trim()}...` : sentence;
}

function createInspirationSummary(transcript, moodLabel) {
  const normalized = String(transcript ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return moodLabel === "tired" || moodLabel === "calm"
      ? "Keep the session soft and low pressure."
      : "Choose one idea and give it a small next step.";
  }

  const clipped = normalized.length > 96 ? `${normalized.slice(0, 93).trim()}...` : normalized;
  return `Noted: ${clipped}`;
}

function getAdjacentMode(currentMode, direction = 1) {
  const normalizedMode = currentMode === "overview" ? "listen" : currentMode;
  const currentIndex = MODE_ORDER.indexOf(normalizedMode);
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (baseIndex + direction + MODE_ORDER.length) % MODE_ORDER.length;
  return MODE_ORDER[nextIndex];
}

function createRejectedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function summarizeRuntimeState(state) {
  return {
    activeMode: state.activeMode ?? null,
    focusedPanel: state.focusedPanel ?? null,
    overlay: state.overlay?.state ?? (state.overlay?.visible ? "controls" : "hidden"),
    playbackState: state.playback?.state ?? null,
    flowState: state.flow?.state ?? null,
    flowSceneId: state.flow?.sceneId ?? null,
    pomodoroState: state.screen?.pomodoroState ?? null,
    screenTask: state.screen?.currentTask ?? null,
    creativeMood: state.creativeCare?.moodLabel ?? null,
    creativeCareMode: state.creativeCare?.currentCareMode ?? null,
    creativeFlowSuggestion: state.creativeCare?.suggestedFlowState ?? null,
    performanceTier: state.system?.performanceTier ?? null,
    renderProfile: state.system?.renderProfile ?? "off",
    flowDiagnosticMode: state.system?.flowDiagnosticMode ?? "off",
    avgFps: state.system?.performance?.avgFps ?? null,
    otaStatus: state.system?.otaStatus ?? null,
    lastSource: state.lastSource ?? null,
  };
}

function didRuntimeStateChange(previousState, nextState) {
  const previousSummary = summarizeRuntimeState(previousState);
  const nextSummary = summarizeRuntimeState(nextState);
  return Object.keys(previousSummary).some((key) => previousSummary[key] !== nextSummary[key]);
}

function summarizeActionPayload(type, payload = {}) {
  if (type === "set_mode") {
    return { mode: payload.mode ?? null };
  }

  if (type === "focus_panel") {
    return { panel: payload.panel ?? null };
  }

  if (type === "set_flow_state") {
    return { state: payload.state ?? null };
  }

  if (type === "set_flow_scene") {
    return {
      sceneId: payload.sceneId ?? null,
      sceneIndex: payload.sceneIndex ?? null,
      state: payload.state ?? null,
    };
  }

  if (type === "next_flow_scene") {
    return { state: payload.state ?? null };
  }

  if (type === "set_volume") {
    return { volume: payload.volume ?? null };
  }

  if (type === "screen_start_pomodoro") {
    return { durationSec: payload.durationSec ?? null };
  }

  if (type === "screen_set_focus_item") {
    return { title: payload.title ?? null };
  }

  if (type === "voice_capture_submit") {
    const transcript = String(payload.transcript ?? "");
    return {
      moodLabel: payload.moodLabel ?? null,
      moodIntensity: payload.moodIntensity ?? null,
      careMode: payload.careMode ?? null,
      captureLength: transcript.length,
    };
  }

  if (type === "voice_mood_set") {
    return {
      moodLabel: payload.moodLabel ?? null,
      moodIntensity: payload.moodIntensity ?? null,
    };
  }

  if (type === "voice_care_mode_set") {
    return { careMode: payload.careMode ?? null };
  }

  if (type === "voice_reflection_clear") {
    return { clear: true };
  }

  if (type === "ota_check" || type === "ota_apply") {
    return { targetVersion: payload.targetVersion ?? null };
  }

  return Object.keys(payload).length ? payload : null;
}

function createInitialState() {
  const renderProfile = normalizeRenderProfile(process.env.RPI_RENDER_PROFILE ?? "off");
  const flowDiagnosticMode = normalizeFlowDiagnosticMode(process.env.TIKPAL_FLOW_DIAGNOSTIC_MODE ?? "off");
  const flowState = "focus";
  const flowSceneState = createFlowSceneState(flowState);
  const flowSceneSelection = resolveFlowSceneSelection({
    flowState,
    sceneId: flowSceneState.sceneId,
    scenesByState: flowSceneState.scenesByState,
  });
  return {
    activeMode: "overview",
    focusedPanel: null,
    transition: {
      status: "idle",
      from: "overview",
      to: "overview",
      startedAt: nowIso(),
      lockedUntil: 0,
    },
    overlay: {
      state: "hidden",
      reason: null,
      visible: false,
    },
    playback: {
      state: "play",
      volume: 58,
      format: "Built-in ambient",
      ...applyFlowSceneToPlayback(
        {
          currentTrackIndex: 0,
          queueLength: getFlowScenesForState(flowState).length,
          ...getQueueTrack(0),
        },
        flowSceneSelection,
      ),
    },
    flow: {
      state: flowState,
      subtitle: "Steady the next thought",
      ...flowSceneState,
      audioMetrics: {
        volumeNormalized: 0.58,
        lowEnergy: 0.28,
        midEnergy: 0.22,
        highEnergy: 0.18,
        beatConfidence: 0.12,
        isPlaying: true,
      },
    },
    screen: {
      currentTask: "Write Ambient OS Spec",
      nextTask: "Review notes",
      currentBlockTitle: "Deep Work Block",
      pomodoroState: "running",
      pomodoroFocusTask: "Write Ambient OS Spec",
      pomodoroDurationSec: 1500,
      pomodoroRemainingSec: 1124,
      completedPomodoros: 0,
      timerUpdatedAt: nowIso(),
      todaySummary: {
        remainingTasks: 55,
        remainingEvents: 2,
      },
      sync: {
        status: "mock",
        stale: false,
      },
    },
    creativeCare: getDefaultCreativeCare(),
    integrations: {
      calendar: {
        connected: false,
        status: "unconfigured",
        accountLabel: null,
        credentialRef: null,
        authUpdatedAt: null,
        lastSyncAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        currentEvent: null,
        nextEvent: null,
        remainingEvents: 0,
      },
      todoist: {
        connected: false,
        status: "unconfigured",
        accountLabel: null,
        credentialRef: null,
        authUpdatedAt: null,
        lastSyncAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        currentTask: null,
        nextTask: null,
        remainingTasks: 55,
      },
    },
    controller: {
      activeSessionCount: 0,
    },
    system: {
      version: process.env.npm_package_version ?? "0.1.0",
      otaStatus: "idle",
      performanceTier: "normal",
      renderProfile,
      flowDiagnosticMode,
      ota: {
        currentVersion: process.env.npm_package_version ?? "0.1.0",
        previousVersion: null,
        targetVersion: null,
        updateAvailable: false,
        canRollback: false,
        releaseRoot: "/opt/tikpal/app/releases",
        currentPath: "/opt/tikpal/app/current",
        previousPath: "/opt/tikpal/app/previous",
        restartRequired: false,
        lastAppliedAt: null,
        lastRestartedAt: null,
        lastHealthCheckAt: null,
        lastRolledBackAt: null,
        lastCheckedAt: null,
        lastErrorCode: null,
        lastOperation: null,
      },
      performance: createInitialPerformanceState(),
    },
    lastSource: "system",
    lastUpdatedAt: nowIso(),
  };
}

function normalizeTransition(transition) {
  if (!transition || transition.status === "idle") {
    return transition;
  }

  if ((transition.lockedUntil ?? 0) <= Date.now()) {
    return {
      ...transition,
      status: "idle",
      lockedUntil: 0,
    };
  }

  return transition;
}

function normalizeScreenTimer(screen) {
  if (!screen || screen.pomodoroState !== "running") {
    return screen;
  }

  const timerUpdatedAt = screen.timerUpdatedAt ? new Date(screen.timerUpdatedAt).getTime() : Date.now();
  const elapsedSec = Math.floor((Date.now() - timerUpdatedAt) / 1000);
  if (elapsedSec <= 0) {
    return screen;
  }

  const remaining = Math.max(0, screen.pomodoroRemainingSec - elapsedSec);
  return {
    ...screen,
    pomodoroRemainingSec: remaining,
    pomodoroState: remaining === 0 ? "idle" : "running",
    timerUpdatedAt: nowIso(),
  };
}

function deriveFlowSubtitle(flowState) {
  if (flowState === "focus") {
    return "Steady the next thought";
  }

  if (flowState === "relax") {
    return "Let the edges soften";
  }

  if (flowState === "sleep") {
    return "Dim the room inside";
  }

  return "Follow the useful spark";
}

function mergeConnectorState(currentConnector = {}, patch = {}) {
  const valueOrCurrent = (key, fallback = null) => (Object.hasOwn(patch, key) ? patch[key] : currentConnector[key] ?? fallback);
  return {
    ...currentConnector,
    ...patch,
    connected: valueOrCurrent("connected", false),
    status: valueOrCurrent("status", "idle"),
    accountLabel: valueOrCurrent("accountLabel"),
    credentialRef: valueOrCurrent("credentialRef"),
    authUpdatedAt: valueOrCurrent("authUpdatedAt"),
    lastSyncAt: valueOrCurrent("lastSyncAt"),
    lastErrorCode: valueOrCurrent("lastErrorCode"),
    lastErrorMessage: valueOrCurrent("lastErrorMessage"),
  };
}

function toFlowSnapshot(state) {
  const overlayVisible = state.overlay.visible;
  const playbackState = state.playback.state;

  let appPhase = "immersive";
  if (state.transition.status !== "idle") {
    appPhase = "transitioning";
  } else if (state.flow.state === "sleep" && !overlayVisible) {
    appPhase = "sleep_dimmed";
  } else if (overlayVisible) {
    appPhase = "controls_visible";
  } else if (state.activeMode !== "flow") {
    appPhase = "idle_preview";
  }

  return {
    currentState: state.flow.state,
    currentScene: {
      sceneId: state.flow.sceneId,
      sceneIndex: state.flow.sceneIndex,
    },
    uiVisible: overlayVisible,
    appPhase,
    playerState: {
      playbackState,
      volume: state.playback.volume,
      trackTitle: state.playback.trackTitle,
      artist: state.playback.artist,
      source: state.playback.source,
      progress: state.playback.progress,
    },
    audioMetrics: {
      ...state.flow.audioMetrics,
      volumeNormalized: state.playback.volume / 100,
      isPlaying: playbackState === "play",
    },
    updatedAt: state.lastUpdatedAt,
    lastSource: state.lastSource,
    source: state.lastSource,
  };
}

function toMapFromEntries(entries = [], keyName = "id") {
  const map = new Map();
  for (const entry of entries) {
    const key = entry?.[keyName];
    if (key) {
      map.set(key, entry);
    }
  }
  return map;
}

function mergePersistedState(defaultState, persistedState) {
  if (!persistedState || typeof persistedState !== "object") {
    return defaultState;
  }

  const hasConfiguredRenderProfile = Object.prototype.hasOwnProperty.call(process.env, "RPI_RENDER_PROFILE");
  const mergedFlow = normalizeFlowSurface({
    ...defaultState.flow,
    ...(persistedState.flow ?? {}),
  });

  return {
    ...defaultState,
    ...persistedState,
    transition: normalizeTransition(persistedState.transition ?? defaultState.transition),
    overlay: {
      ...defaultState.overlay,
      ...(persistedState.overlay ?? {}),
    },
    playback: {
      ...defaultState.playback,
      ...(persistedState.playback ?? {}),
    },
    flow: mergedFlow,
    screen: {
      ...defaultState.screen,
      ...(persistedState.screen ?? {}),
      todaySummary: {
        ...defaultState.screen.todaySummary,
        ...(persistedState.screen?.todaySummary ?? {}),
      },
      sync: {
        ...defaultState.screen.sync,
        ...(persistedState.screen?.sync ?? {}),
      },
    },
    creativeCare: {
      ...defaultState.creativeCare,
      ...(persistedState.creativeCare ?? {}),
      metadata: {
        ...defaultState.creativeCare.metadata,
        ...(persistedState.creativeCare?.metadata ?? {}),
      },
    },
    integrations: {
      calendar: mergeConnectorState(defaultState.integrations.calendar, persistedState.integrations?.calendar),
      todoist: mergeConnectorState(defaultState.integrations.todoist, persistedState.integrations?.todoist),
    },
    controller: {
      ...defaultState.controller,
      ...(persistedState.controller ?? {}),
    },
    system: {
      ...defaultState.system,
      ...(persistedState.system ?? {}),
      performanceTier: normalizePerformanceTier(persistedState.system?.performanceTier ?? defaultState.system.performanceTier),
      renderProfile: normalizeRenderProfile(
        hasConfiguredRenderProfile
          ? defaultState.system.renderProfile
          : persistedState.system?.renderProfile ?? defaultState.system.renderProfile ?? "off",
      ),
      flowDiagnosticMode: normalizeFlowDiagnosticMode(
        persistedState.system?.flowDiagnosticMode ?? defaultState.system.flowDiagnosticMode ?? "off",
      ),
      ota: {
        ...defaultState.system.ota,
        ...(persistedState.system?.ota ?? {}),
      },
      performance: {
        ...defaultState.system.performance,
        ...(persistedState.system?.performance ?? {}),
      },
    },
  };
}

function createSafeCredentialRecord(name, payload = {}, credentialRef, now = nowIso()) {
  return {
    provider: name,
    accountLabel: payload.accountLabel ?? `${name}.local`,
    credentialRef,
    tokenExpiresAt: payload.tokenExpiresAt ?? null,
    metadata: payload.metadata ?? {},
    createdAt: payload.createdAt ?? now,
    updatedAt: now,
  };
}

function createSecretRecord(payload = {}, previous = {}) {
  return {
    accessToken: payload.accessToken ?? previous.accessToken ?? null,
    refreshToken: payload.refreshToken ?? previous.refreshToken ?? null,
    tokenExpiresAt: payload.tokenExpiresAt ?? previous.tokenExpiresAt ?? null,
    metadata: {
      ...(previous.metadata ?? {}),
      ...(payload.secretMetadata ?? payload.metadata ?? {}),
    },
  };
}

export function createSystemStateStore({ persistence = null, secretStore = null, otaManager = null } = {}) {
  const persisted = persistence?.read?.() ?? null;
  let state = mergePersistedState(createInitialState(), persisted?.state);
  if (otaManager) {
    state = {
      ...state,
      system: {
        ...state.system,
        ota: {
          ...state.system.ota,
          releaseRoot: otaManager.releaseRoot ?? state.system.ota.releaseRoot,
          currentPath: otaManager.currentPath ?? state.system.ota.currentPath,
          previousPath: otaManager.previousPath ?? state.system.ota.previousPath,
        },
      },
    };
  }
  const sessions = new Map();
  const sessionIdsByToken = new Map();
  const pairingCodes = new Map();
  const connectorCredentials = new Map();
  const actionLogs = [];
  const stateTransitionLogs = [];
  const performanceSamples = [];

  for (const session of persisted?.sessions ?? []) {
    if (!session?.id || !session?.token) {
      continue;
    }

    sessions.set(session.id, session);
    sessionIdsByToken.set(session.token, session.id);
  }

  for (const [code, pairing] of toMapFromEntries(persisted?.pairingCodes, "code")) {
    pairingCodes.set(code, pairing);
  }

  for (const [name, credential] of toMapFromEntries(persisted?.connectorCredentials, "provider")) {
    if (CONNECTOR_NAMES.includes(name)) {
      connectorCredentials.set(name, credential);
    }
  }

  syncControllerCount();

  function createPersistenceSnapshot() {
    return {
      version: PERSISTENCE_VERSION,
      savedAt: nowIso(),
      state,
      sessions: Array.from(sessions.values()),
      pairingCodes: Array.from(pairingCodes.values()),
      connectorCredentials: Array.from(connectorCredentials.values()).map((credential) => ({
        provider: credential.provider,
        accountLabel: credential.accountLabel,
        credentialRef: credential.credentialRef,
        tokenExpiresAt: credential.tokenExpiresAt ?? null,
        metadata: credential.metadata ?? {},
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      })),
    };
  }

  function persistNow() {
    persistence?.write?.(createPersistenceSnapshot());
  }

  function appendLog(buffer, entry) {
    buffer.push(entry);
    if (buffer.length > MAX_RUNTIME_LOG_ENTRIES) {
      buffer.splice(0, buffer.length - MAX_RUNTIME_LOG_ENTRIES);
    }
  }

  function recordActionLog(entry) {
    appendLog(actionLogs, entry);
  }

  function recordStateTransition(source, reasonAction, previousState, nextState) {
    if (!didRuntimeStateChange(previousState, nextState)) {
      return;
    }

    appendLog(stateTransitionLogs, {
      timestamp: nowIso(),
      source,
      reasonAction: reasonAction ?? null,
      from: summarizeRuntimeState(previousState),
      to: summarizeRuntimeState(nextState),
    });
  }

  function recordPerformanceSample(sample) {
    appendLog(performanceSamples, {
      timestamp: nowIso(),
      avgFps: sample.avgFps ?? null,
      tier: sample.tier ?? null,
      tierChanged: Boolean(sample.tierChanged),
      tierDecisionReason: sample.tierDecisionReason ?? null,
      tierCooldownUntil: sample.tierCooldownUntil ?? null,
      tierCooldownRemainingMs: sample.tierCooldownRemainingMs ?? null,
      activeMode: sample.activeMode ?? null,
      temperatureC: sample.temperatureC ?? null,
      interactionLatencyMs: sample.interactionLatencyMs ?? null,
      memoryUsageMb: sample.memoryUsageMb ?? null,
      reason: sample.reason ?? null,
      rendererType: sample.rendererType ?? "image",
      requestedRenderer: sample.requestedRenderer ?? "image",
      chromiumExperiment: sample.chromiumExperiment ?? "baseline",
      rendererFallbackCount: sample.rendererFallbackCount ?? 0,
      glInitErrorCount: sample.glInitErrorCount ?? 0,
      glContextLostCount: sample.glContextLostCount ?? 0,
      rendererFallbackReason: sample.rendererFallbackReason ?? null,
      flowDiagnosticMode: normalizeFlowDiagnosticMode(sample.flowDiagnosticMode ?? "off"),
      diagnostics: sample.diagnostics ?? null,
      source: sample.source ?? null,
    });
  }

  function syncControllerCount() {
    if ((state.controller?.activeSessionCount ?? 0) === sessions.size) {
      return;
    }

    state = {
      ...state,
      controller: {
        ...state.controller,
        activeSessionCount: sessions.size,
      },
    };
  }

  function isSessionExpired(session) {
    return Boolean(session?.expiresAt && new Date(session.expiresAt).getTime() <= Date.now());
  }

  function sanitizeSession(session, { includeToken = false } = {}) {
    if (!session) {
      return null;
    }

    const snapshot = {
      id: session.id,
      deviceId: session.deviceId,
      name: session.name,
      role: session.role,
      scopes: [...session.scopes],
      capabilities: [...session.capabilities],
      source: session.source,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastSeenAt: session.lastSeenAt ?? null,
      revoked: Boolean(session.revoked),
    };

    if (includeToken) {
      snapshot.token = session.token;
    }

    return snapshot;
  }

  function removeSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return false;
    }

    sessions.delete(sessionId);
    if (session.token) {
      sessionIdsByToken.delete(session.token);
    }
    syncControllerCount();
    persistNow();
    return true;
  }

  function cleanupExpiredSessions() {
    let removed = false;
    for (const [sessionId, session] of sessions.entries()) {
      if (session.revoked || isSessionExpired(session)) {
        removeSession(sessionId);
        removed = true;
      }
    }

    if (!removed) {
      syncControllerCount();
    }
  }

  function cleanupExpiredPairingCodes() {
    let removed = false;
    for (const [code, pairing] of pairingCodes.entries()) {
      if ((pairing.expiresAt && new Date(pairing.expiresAt).getTime() <= Date.now()) || pairing.claimedAt) {
        pairingCodes.delete(code);
        removed = true;
      }
    }
    if (removed) {
      persistNow();
    }
  }

  function getNormalizedState() {
    cleanupExpiredSessions();
    const normalizedTransition = normalizeTransition(state.transition);
    const normalizedScreen = normalizeScreenTimer(state.screen);
    const normalizedFlow = normalizeFlowSurface(state.flow);
    const didFlowChange =
      state.flow?.state !== normalizedFlow.state ||
      state.flow?.subtitle !== normalizedFlow.subtitle ||
      state.flow?.sceneId !== normalizedFlow.sceneId ||
      state.flow?.sceneIndex !== normalizedFlow.sceneIndex ||
      JSON.stringify(normalizeFlowScenesByState(state.flow?.scenesByState)) !== JSON.stringify(normalizedFlow.scenesByState);
    if (normalizedTransition !== state.transition || normalizedScreen !== state.screen || didFlowChange) {
      state = {
        ...state,
        transition: normalizedTransition,
        screen: normalizedScreen,
        flow: normalizedFlow,
      };
      persistNow();
    }

    return state;
  }

  function updateState(nextState, source = state.lastSource, reasonAction = null) {
    const previousState = state;
    state = {
      ...nextState,
      controller: {
        ...nextState.controller,
        activeSessionCount: sessions.size,
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
    recordStateTransition(source, reasonAction, previousState, state);
    persistNow();
    return state;
  }

  function setMode(mode, source, reasonAction = "set_mode") {
    const liveState = getNormalizedState();
    if (mode !== "overview" && !MODE_ORDER.includes(mode)) {
      throw createRejectedError("INVALID_MODE", `Unsupported mode: ${mode}`);
    }

    const activeMode = mode === "overview" ? "overview" : mode;
    if (liveState.activeMode === activeMode && liveState.transition.status === "idle") {
      return liveState;
    }

    const focusedPanel = mode === "overview" ? liveState.activeMode === "overview" ? liveState.focusedPanel : liveState.activeMode : mode;
    return updateState(
      {
        ...liveState,
        activeMode,
        focusedPanel,
        transition: {
          status: "animating",
          from: liveState.activeMode,
          to: activeMode,
          startedAt: nowIso(),
          lockedUntil: Date.now() + MODE_TRANSITION_MS,
        },
      },
      source,
      reasonAction,
    );
  }

  function focusPanel(panel, source, reasonAction = "focus_panel") {
    const liveState = getNormalizedState();
    if (!MODE_ORDER.includes(panel)) {
      throw createRejectedError("INVALID_PANEL", `Unsupported overview panel: ${panel}`);
    }

    if (liveState.activeMode === "overview" && liveState.focusedPanel === panel) {
      return liveState;
    }

    return updateState(
      {
        ...liveState,
        activeMode: "overview",
        focusedPanel: panel,
      },
      source,
      reasonAction,
    );
  }

  function getCapabilities() {
    return {
      modes: ["overview", "listen", "flow", "screen"],
      flowStates: FLOW_ORDER,
      flowScenes: FLOW_ORDER.map((flowState) => ({
        state: flowState,
        items: getFlowScenesForState(flowState).map((scene) => ({
          id: scene.id,
          index: scene.index,
          label: scene.label,
          subtitle: scene.subtitle,
          ritualLabelZh: scene.ritualLabelZh,
        })),
      })),
      touch: {
        multiTouch: true,
        singleTouchDownInFlow: "next_flow_scene",
      },
      screenFeatures: {
        tasks: true,
        schedule: true,
        pomodoro: true,
      },
      creativeCare: {
        supported: true,
        moods: CREATIVE_CARE_MOODS,
        careModes: CREATIVE_CARE_MODES,
        speechRecognition: "optional",
      },
      integrations: {
        calendar: true,
        todoist: true,
      },
      ota: {
        supported: true,
        rollback: true,
      },
      performance: {
        tier: state.system.performanceTier,
        renderProfile: state.system.renderProfile ?? "off",
        flowDiagnosticMode: state.system.flowDiagnosticMode ?? "off",
        policy: createPerformancePolicySnapshot(),
      },
      auth: {
        roles: ROLE_ORDER,
        sessionAuth: true,
      },
      controllerSessions: {
        supported: true,
        defaultRole: "controller",
        defaultTtlSec: DEFAULT_SESSION_TTL_SEC,
      },
    };
  }

  function getSnapshot() {
    return getNormalizedState();
  }

  function patchFlowState(patch, source = "remote-client") {
    const liveState = getNormalizedState();
    const nextPlayback = patch.playerState
      ? {
          ...liveState.playback,
          state: patch.playerState.playbackState ?? liveState.playback.state,
          volume: patch.playerState.volume ?? liveState.playback.volume,
          trackTitle: patch.playerState.trackTitle ?? liveState.playback.trackTitle,
          artist: patch.playerState.artist ?? liveState.playback.artist,
          source: patch.playerState.source ?? liveState.playback.source,
          progress: patch.playerState.progress ?? liveState.playback.progress,
        }
      : liveState.playback;

    const nextFlow = {
      ...liveState.flow,
      state: patch.currentState ?? liveState.flow.state,
      subtitle: deriveFlowSubtitle(patch.currentState ?? liveState.flow.state),
      audioMetrics: {
        ...liveState.flow.audioMetrics,
        ...(patch.audioMetrics ?? {}),
      },
    };

    updateState(
      {
        ...liveState,
        activeMode: "flow",
        focusedPanel: "flow",
        overlay: {
          ...liveState.overlay,
          visible: patch.uiVisible ?? liveState.overlay.visible,
          state: (patch.uiVisible ?? liveState.overlay.visible) ? "controls" : "hidden",
        },
        playback: nextPlayback,
        flow: nextFlow,
      },
      source,
      "patch_flow_state",
    );

    return toFlowSnapshot(state);
  }

  function patchPlaybackState(playerState = {}, source = "player_sync") {
    const liveState = getNormalizedState();
    const nextPlayback = mergePlayerState(liveState.playback, playerState);

    return updateState(
      {
        ...liveState,
        playback: nextPlayback,
        flow: {
          ...liveState.flow,
          audioMetrics: {
            ...liveState.flow.audioMetrics,
            volumeNormalized: nextPlayback.volume / 100,
            isPlaying: nextPlayback.state === "play",
          },
        },
      },
      source,
      "patch_playback_state",
    );
  }

  function patchIntegration(name, patch = {}, source = "system") {
    const liveState = getNormalizedState();
    if (!CONNECTOR_NAMES.includes(name)) {
      throw createRejectedError("INVALID_CONNECTOR", `Unsupported connector: ${name}`);
    }

    return updateState(
      {
        ...liveState,
        integrations: {
          ...liveState.integrations,
          [name]: mergeConnectorState(liveState.integrations?.[name], patch),
        },
      },
      source,
      `patch_integration_${name}`,
    );
  }

  function getIntegrationStatuses() {
    return structuredClone(getNormalizedState().integrations ?? {});
  }

  function hasIntegrationCredential(name) {
    return connectorCredentials.has(name);
  }

  function getIntegrationCredential(name) {
    const credential = connectorCredentials.get(name);
    if (!credential) {
      return null;
    }

    const secret = secretStore?.get?.(name) ?? {};
    return {
      ...structuredClone(credential),
      accessToken: secret.accessToken ?? null,
      refreshToken: secret.refreshToken ?? null,
      tokenExpiresAt: secret.tokenExpiresAt ?? credential.tokenExpiresAt ?? null,
      metadata: {
        ...(credential.metadata ?? {}),
        ...(secret.metadata ?? {}),
      },
    };
  }

  function bindIntegration(name, payload = {}, source = "admin_client") {
    if (!CONNECTOR_NAMES.includes(name)) {
      throw createRejectedError("INVALID_CONNECTOR", `Unsupported connector: ${name}`);
    }

    const authUpdatedAt = nowIso();
    const credentialRef = `local:${name}:${payload.accountLabel ?? "default"}`;
    connectorCredentials.set(
      name,
      createSafeCredentialRecord(
        name,
        {
          ...payload,
          createdAt: connectorCredentials.get(name)?.createdAt,
        },
        credentialRef,
        authUpdatedAt,
      ),
    );
    if (payload.accessToken || payload.refreshToken || payload.secretMetadata) {
      secretStore?.set?.(name, createSecretRecord(payload, secretStore?.get?.(name) ?? {}));
    }

    return patchIntegration(
      name,
      {
        connected: true,
        status: payload.status ?? "idle",
        accountLabel: payload.accountLabel ?? `${name}.local`,
        credentialRef,
        authUpdatedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      source,
    );
  }

  function revokeIntegration(name, source = "admin_client") {
    if (!CONNECTOR_NAMES.includes(name)) {
      throw createRejectedError("INVALID_CONNECTOR", `Unsupported connector: ${name}`);
    }

    connectorCredentials.delete(name);
    secretStore?.delete?.(name);
    persistNow();
    return patchIntegration(
      name,
      {
        connected: false,
        status: "revoked",
        accountLabel: null,
        credentialRef: null,
        authUpdatedAt: nowIso(),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      source,
    );
  }

  function updateIntegrationCredential(name, payload = {}, source = "system") {
    if (!CONNECTOR_NAMES.includes(name)) {
      throw createRejectedError("INVALID_CONNECTOR", `Unsupported connector: ${name}`);
    }

    const existing = connectorCredentials.get(name);
    if (!existing) {
      throw createRejectedError(`${name.toUpperCase()}_CREDENTIAL_MISSING`, `${name} connector is not bound`);
    }

    const updatedAt = nowIso();
    const previousSecret = secretStore?.get?.(name) ?? {};
    connectorCredentials.set(
      name,
      createSafeCredentialRecord(
        name,
        {
          ...existing,
          ...payload,
          metadata: {
            ...(existing.metadata ?? {}),
            ...(payload.metadata ?? {}),
          },
          createdAt: existing.createdAt,
        },
        existing.credentialRef,
        updatedAt,
      ),
    );

    if (payload.accessToken || payload.refreshToken || payload.tokenExpiresAt || payload.secretMetadata || payload.metadata) {
      secretStore?.set?.(name, createSecretRecord(payload, previousSecret));
    }

    return patchIntegration(
      name,
      {
        connected: true,
        credentialRef: existing.credentialRef,
        accountLabel: payload.accountLabel ?? existing.accountLabel,
        authUpdatedAt: updatedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      source,
    );
  }

  function runFlowAction(type, payload = {}, source = "remote-client") {
    const liveState = getNormalizedState();

    if (type === "set_state") {
      runAction("set_flow_state", { state: payload.state }, source);
      return toFlowSnapshot(state);
    }

    if (type === "next_state") {
      const currentIndex = FLOW_ORDER.indexOf(liveState.flow.state);
      const direction = payload.direction === "left" ? -1 : 1;
      const nextIndex = (currentIndex + direction + FLOW_ORDER.length) % FLOW_ORDER.length;
      runAction("set_flow_state", { state: FLOW_ORDER[nextIndex] }, source);
      return toFlowSnapshot(state);
    }

    if (type === "set_track") {
      updateState(
        {
          ...state,
          playback: {
            ...state.playback,
            trackTitle: payload.trackTitle ?? state.playback.trackTitle,
            artist: payload.artist ?? state.playback.artist,
            source: payload.source ?? state.playback.source,
          },
        },
        source,
      );
      return toFlowSnapshot(state);
    }

    runAction(type, payload, source);
    return toFlowSnapshot(state);
  }

  function runAction(type, payload = {}, source = "remote-client") {
    const liveState = getNormalizedState();
    const startedAtMs = Date.now();
    const timestamp = nowIso();

    function finalize(snapshot) {
      recordActionLog({
        timestamp,
        source,
        actionType: type,
        payloadSummary: summarizeActionPayload(type, payload),
        result: didRuntimeStateChange(liveState, snapshot) ? "applied" : "ignored",
        errorCode: null,
        durationMs: Date.now() - startedAtMs,
      });
      return snapshot;
    }

    function recordOtaFailure(error) {
      if (!type.startsWith("ota_") || !OTA_OPERATIONAL_ERROR_CODES.has(error.code)) {
        return;
      }

      const failedAt = nowIso();
      updateState(
        {
          ...state,
          system: {
            ...state.system,
            otaStatus: "error",
            ota: {
              ...state.system.ota,
              targetVersion: error.targetVersion ?? payload.targetVersion ?? state.system.ota?.targetVersion ?? null,
              previousVersion: error.previousVersion ?? state.system.ota?.previousVersion ?? null,
              updateAvailable: Boolean(state.system.ota?.updateAvailable),
              canRollback: Boolean(error.previousVersion ?? state.system.ota?.previousVersion),
              restartRequired: false,
              lastErrorCode: error.code,
              lastOperation: {
                type,
                status: "failed",
                phases: [type === "ota_rollback" ? "rollback" : "verifying", "failed"],
                releasePath: error.releasePath ?? null,
                manifestPath: error.manifestPath ?? null,
                manifest: error.manifest ?? null,
                restart: error.restart ?? null,
                health: error.health ?? null,
                message: error.message,
                updatedAt: failedAt,
              },
            },
          },
        },
        source,
        type,
      );
    }

    try {
      if (liveState.system.otaStatus === "applying" && !type.startsWith("ota_")) {
        const error = new Error("OTA is in progress");
        error.code = "OTA_IN_PROGRESS";
        throw error;
      }

      if (
        liveState.transition.status !== "idle" &&
        ["set_mode", "return_overview", "next_mode", "prev_mode"].includes(type)
      ) {
        return finalize(liveState);
      }

      if (type === "set_mode") {
        return finalize(setMode(payload.mode ?? "overview", source, "set_mode"));
      }

      if (type === "return_overview") {
        return finalize(setMode("overview", source, "return_overview"));
      }

      if (type === "focus_panel") {
        return finalize(focusPanel(payload.panel ?? liveState.focusedPanel ?? "listen", source, "focus_panel"));
      }

      if (type === "next_mode") {
        return finalize(setMode(getAdjacentMode(liveState.activeMode, 1), source, "next_mode"));
      }

      if (type === "prev_mode") {
        return finalize(setMode(getAdjacentMode(liveState.activeMode, -1), source, "prev_mode"));
      }

      if (type === "show_controls") {
        if (liveState.overlay.visible) {
          return finalize(liveState);
        }

        return finalize(
          updateState(
            {
              ...liveState,
              overlay: {
                state: "controls",
                reason: payload.reason ?? "user",
                visible: true,
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "hide_controls") {
        if (!liveState.overlay.visible) {
          return finalize(liveState);
        }

        return finalize(
          updateState(
            {
              ...liveState,
              overlay: {
                state: "hidden",
                reason: null,
                visible: false,
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "toggle_play") {
        const nextPlayback = payload.playerState
          ? mergePlayerState(liveState.playback, payload.playerState)
          : {
              ...liveState.playback,
              state: liveState.playback.state === "play" ? "pause" : "play",
            };
        const nextPlaybackState = nextPlayback.state;
        return finalize(
          updateState(
            {
              ...liveState,
              playback: nextPlayback,
              flow: {
                ...liveState.flow,
                audioMetrics: {
                  ...liveState.flow.audioMetrics,
                  isPlaying: nextPlaybackState === "play",
                },
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "prev_track" || type === "next_track") {
        const step = type === "next_track" ? 1 : -1;
        if (!payload.playerState && liveState.activeMode === "flow") {
          const sceneSelection = getNextFlowSceneSelection({
            flowState: liveState.flow.state,
            sceneId: liveState.flow.sceneId,
            scenesByState: liveState.flow.scenesByState,
            step,
          });
          return finalize(
            updateState(
              {
                ...liveState,
                flow: {
                  ...liveState.flow,
                  sceneId: sceneSelection.sceneId,
                  sceneIndex: sceneSelection.sceneIndex,
                  scenesByState: sceneSelection.scenesByState,
                },
                playback: applyFlowSceneToPlayback(liveState.playback, sceneSelection),
              },
              source,
              type,
            ),
          );
        }

        const nextIndex = (Number(liveState.playback.currentTrackIndex ?? 0) + step + MOCK_QUEUE.length) % MOCK_QUEUE.length;
        const nextPlayback = payload.playerState
          ? {
              ...mergePlayerState(liveState.playback, payload.playerState),
              currentTrackIndex: liveState.playback.currentTrackIndex,
              queueLength: liveState.playback.queueLength,
            }
          : {
              ...liveState.playback,
              currentTrackIndex: nextIndex,
              queueLength: MOCK_QUEUE.length,
              ...getQueueTrack(nextIndex),
            };
        return finalize(
          updateState(
            {
              ...liveState,
              playback: nextPlayback,
            },
            source,
            type,
          ),
        );
      }

      if (type === "set_volume") {
        const volume = clamp(Number(payload.volume ?? liveState.playback.volume), 0, 100);
        const nextPlayback = mergePlayerState(
          {
            ...liveState.playback,
            volume,
          },
          payload.playerState,
        );
        return finalize(
          updateState(
            {
              ...liveState,
              playback: nextPlayback,
              flow: {
                ...liveState.flow,
                audioMetrics: {
                  ...liveState.flow.audioMetrics,
                  volumeNormalized: nextPlayback.volume / 100,
                },
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "set_flow_state") {
        if (!FLOW_ORDER.includes(payload.state)) {
          throw createRejectedError("INVALID_FLOW_STATE", `Unsupported flow state: ${payload.state}`);
        }

        const nextFlowState = FLOW_ORDER.includes(payload.state) ? payload.state : liveState.flow.state;
        const sceneSelection = resolveFlowSceneSelection({
          flowState: nextFlowState,
          sceneId: liveState.flow.state === nextFlowState ? liveState.flow.sceneId : null,
          scenesByState: liveState.flow.scenesByState,
        });
        return finalize(
          updateState(
            {
              ...liveState,
              activeMode: "flow",
              focusedPanel: "flow",
              transition: {
                status: "animating",
                from: liveState.activeMode,
                to: "flow",
                startedAt: nowIso(),
                lockedUntil: Date.now() + FLOW_TRANSITION_MS,
              },
              flow: {
                ...liveState.flow,
                state: nextFlowState,
                subtitle: deriveFlowSubtitle(nextFlowState),
                sceneId: sceneSelection.sceneId,
                sceneIndex: sceneSelection.sceneIndex,
                scenesByState: sceneSelection.scenesByState,
              },
              playback: applyFlowSceneToPlayback(liveState.playback, sceneSelection),
            },
            source,
            type,
          ),
        );
      }

      if (type === "next_flow_scene") {
        const nextFlowState = normalizeFlowState(payload.state ?? liveState.flow.state);
        const sceneSelection = getNextFlowSceneSelection({
          flowState: nextFlowState,
          sceneId: liveState.flow.sceneId,
          scenesByState: liveState.flow.scenesByState,
          step: 1,
        });
        const nextPlayback = payload.playerState
          ? mergePlayerState(applyFlowSceneToPlayback(liveState.playback, sceneSelection), payload.playerState)
          : applyFlowSceneToPlayback(liveState.playback, sceneSelection);
        return finalize(
          updateState(
            {
              ...liveState,
              activeMode: "flow",
              focusedPanel: "flow",
              transition: {
                status: "animating",
                from: "flow",
                to: "flow",
                startedAt: nowIso(),
                lockedUntil: Date.now() + FLOW_TRANSITION_MS,
              },
              flow: {
                ...liveState.flow,
                state: nextFlowState,
                subtitle: deriveFlowSubtitle(nextFlowState),
                sceneId: sceneSelection.sceneId,
                sceneIndex: sceneSelection.sceneIndex,
                scenesByState: sceneSelection.scenesByState,
              },
              playback: nextPlayback,
            },
            source,
            type,
          ),
        );
      }

      if (type === "prev_flow_scene") {
        const nextFlowState = normalizeFlowState(payload.state ?? liveState.flow.state);
        const sceneSelection = getNextFlowSceneSelection({
          flowState: nextFlowState,
          sceneId: liveState.flow.sceneId,
          scenesByState: liveState.flow.scenesByState,
          step: -1,
        });
        const nextPlayback = payload.playerState
          ? mergePlayerState(applyFlowSceneToPlayback(liveState.playback, sceneSelection), payload.playerState)
          : applyFlowSceneToPlayback(liveState.playback, sceneSelection);
        return finalize(
          updateState(
            {
              ...liveState,
              activeMode: "flow",
              focusedPanel: "flow",
              transition: {
                status: "animating",
                from: "flow",
                to: "flow",
                startedAt: nowIso(),
                lockedUntil: Date.now() + FLOW_TRANSITION_MS,
              },
              flow: {
                ...liveState.flow,
                state: nextFlowState,
                subtitle: deriveFlowSubtitle(nextFlowState),
                sceneId: sceneSelection.sceneId,
                sceneIndex: sceneSelection.sceneIndex,
                scenesByState: sceneSelection.scenesByState,
              },
              playback: nextPlayback,
            },
            source,
            type,
          ),
        );
      }

      if (type === "set_flow_scene") {
        const explicitScene = payload.sceneId ? getFlowSceneById(payload.sceneId) : null;
        if (payload.sceneId && !explicitScene) {
          throw createRejectedError("INVALID_FLOW_SCENE", `Unsupported flow scene: ${payload.sceneId}`);
        }

        const nextFlowState = normalizeFlowState(explicitScene?.state ?? payload.state ?? liveState.flow.state);
        const sceneSelection = resolveFlowSceneSelection({
          flowState: nextFlowState,
          sceneId: explicitScene?.id ?? payload.sceneId ?? null,
          sceneIndex: payload.sceneIndex,
          scenesByState: liveState.flow.scenesByState,
        });
        const nextPlayback = payload.playerState
          ? mergePlayerState(applyFlowSceneToPlayback(liveState.playback, sceneSelection), payload.playerState)
          : applyFlowSceneToPlayback(liveState.playback, sceneSelection);
        return finalize(
          updateState(
            {
              ...liveState,
              activeMode: "flow",
              focusedPanel: "flow",
              transition: {
                status: "animating",
                from: "flow",
                to: "flow",
                startedAt: nowIso(),
                lockedUntil: Date.now() + FLOW_TRANSITION_MS,
              },
              flow: {
                ...liveState.flow,
                state: nextFlowState,
                subtitle: deriveFlowSubtitle(nextFlowState),
                sceneId: sceneSelection.sceneId,
                sceneIndex: sceneSelection.sceneIndex,
                scenesByState: sceneSelection.scenesByState,
              },
              playback: nextPlayback,
            },
            source,
            type,
          ),
        );
      }

      if (type === "screen_start_pomodoro") {
        const durationSec = clamp(Number(payload.durationSec ?? liveState.screen.pomodoroDurationSec ?? 1500), 60, 7200);
        return finalize(
          updateState(
            {
              ...liveState,
              activeMode: "screen",
              focusedPanel: "screen",
              screen: {
                ...liveState.screen,
                pomodoroState: "running",
                pomodoroFocusTask: liveState.screen.currentTask,
                pomodoroDurationSec: durationSec,
                pomodoroRemainingSec: durationSec,
                timerUpdatedAt: nowIso(),
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "screen_resume_pomodoro") {
        return finalize(
          updateState(
            {
              ...liveState,
              screen: {
                ...liveState.screen,
                pomodoroState: "running",
                timerUpdatedAt: nowIso(),
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "screen_pause_pomodoro") {
        return finalize(
          updateState(
            {
              ...liveState,
              screen: {
                ...liveState.screen,
                pomodoroState: "paused",
                timerUpdatedAt: nowIso(),
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "screen_reset_pomodoro") {
        return finalize(
          updateState(
            {
              ...liveState,
              screen: {
                ...liveState.screen,
                pomodoroState: "idle",
                pomodoroFocusTask: liveState.screen.currentTask,
                pomodoroRemainingSec: liveState.screen.pomodoroDurationSec,
                timerUpdatedAt: nowIso(),
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "screen_complete_current_task") {
        return finalize(
          updateState(
            {
              ...liveState,
              screen: {
                ...liveState.screen,
                currentTask: liveState.screen.nextTask,
                nextTask: "Plan next session",
                pomodoroFocusTask: liveState.screen.nextTask,
                completedPomodoros: Number(liveState.screen.completedPomodoros ?? 0) + 1,
                pomodoroState: "idle",
                pomodoroRemainingSec: liveState.screen.pomodoroDurationSec,
                timerUpdatedAt: nowIso(),
                todaySummary: {
                  ...liveState.screen.todaySummary,
                  remainingTasks: Math.max(0, liveState.screen.todaySummary.remainingTasks - 1),
                },
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "screen_set_focus_item") {
        return finalize(
          updateState(
            {
              ...liveState,
              activeMode: "screen",
              focusedPanel: "screen",
              screen: {
                ...liveState.screen,
                currentTask: payload.title ?? liveState.screen.currentTask,
                pomodoroFocusTask: payload.title ?? liveState.screen.currentTask,
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "system_reboot" || type === "system_shutdown") {
        return finalize(
          updateState(
            {
              ...liveState,
              overlay: {
                state: "hidden",
                reason: null,
                visible: false,
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "voice_capture_submit") {
        const transcript = String(payload.transcript ?? "").replace(/\s+/g, " ").trim();
        const previousCare = liveState.creativeCare ?? getDefaultCreativeCare();
        const moodLabel = normalizeMoodLabel(payload.moodLabel, previousCare.moodLabel);
        if (payload.moodLabel && !CREATIVE_CARE_MOODS.includes(payload.moodLabel)) {
          throw createRejectedError("INVALID_VOICE_MOOD", `Unsupported mood: ${payload.moodLabel}`);
        }

        if (payload.careMode && !CREATIVE_CARE_MODES.includes(payload.careMode)) {
          throw createRejectedError("INVALID_CARE_MODE", `Unsupported care mode: ${payload.careMode}`);
        }

        const currentCareMode = normalizeCareMode(payload.careMode, deriveCareModeFromMood(moodLabel));
        const moodIntensity = clamp(Number(payload.moodIntensity ?? previousCare.moodIntensity ?? 0.45), 0, 1);
        const suggestedFlowState = deriveFlowStateFromCareMode(currentCareMode);
        const insightSentence = createInsightSentence(transcript, previousCare.insightSentence);
        return finalize(
          updateState(
            {
              ...liveState,
              creativeCare: {
                ...previousCare,
                latestTranscript: transcript,
                moodLabel,
                moodIntensity,
                inspirationSummary: payload.inspirationSummary
                  ? createInsightSentence(payload.inspirationSummary, previousCare.inspirationSummary)
                  : createInspirationSummary(transcript, moodLabel),
                suggestedFlowState,
                currentCareMode,
                insightSentence,
                updatedAt: nowIso(),
                metadata: {
                  source: payload.source ?? source,
                  captureLength: transcript.length,
                },
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "voice_mood_set") {
        if (!CREATIVE_CARE_MOODS.includes(payload.moodLabel)) {
          throw createRejectedError("INVALID_VOICE_MOOD", `Unsupported mood: ${payload.moodLabel}`);
        }

        const previousCare = liveState.creativeCare ?? getDefaultCreativeCare();
        const moodLabel = payload.moodLabel;
        const currentCareMode = deriveCareModeFromMood(moodLabel);
        return finalize(
          updateState(
            {
              ...liveState,
              creativeCare: {
                ...previousCare,
                moodLabel,
                moodIntensity: clamp(Number(payload.moodIntensity ?? previousCare.moodIntensity ?? 0.45), 0, 1),
                currentCareMode,
                suggestedFlowState: deriveFlowStateFromCareMode(currentCareMode),
                updatedAt: nowIso(),
                metadata: {
                  ...(previousCare.metadata ?? {}),
                  source: payload.source ?? source,
                },
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "voice_care_mode_set") {
        if (!CREATIVE_CARE_MODES.includes(payload.careMode)) {
          throw createRejectedError("INVALID_CARE_MODE", `Unsupported care mode: ${payload.careMode}`);
        }

        const previousCare = liveState.creativeCare ?? getDefaultCreativeCare();
        return finalize(
          updateState(
            {
              ...liveState,
              creativeCare: {
                ...previousCare,
                currentCareMode: payload.careMode,
                suggestedFlowState: deriveFlowStateFromCareMode(payload.careMode),
                updatedAt: nowIso(),
                metadata: {
                  ...(previousCare.metadata ?? {}),
                  source: payload.source ?? source,
                },
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "voice_reflection_clear") {
        const previousCare = liveState.creativeCare ?? getDefaultCreativeCare();
        return finalize(
          updateState(
            {
              ...liveState,
              creativeCare: {
                ...getDefaultCreativeCare(),
                moodLabel: previousCare.moodLabel ?? "clear",
                moodIntensity: previousCare.moodIntensity ?? 0.45,
                currentCareMode: previousCare.currentCareMode ?? "flow",
                suggestedFlowState: previousCare.suggestedFlowState ?? "flow",
                updatedAt: nowIso(),
                metadata: {
                  source,
                  captureLength: 0,
                },
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "runtime_set_performance_tier") {
        const nextTier = PERFORMANCE_TIERS.includes(payload.tier)
          ? payload.tier
          : normalizePerformanceTier(liveState.system.performanceTier);
        const nowMs = Date.now();
        const tierChanged = nextTier !== normalizePerformanceTier(liveState.system.performanceTier);
        const tierCooldownUntil = tierChanged
          ? nowMs + PERFORMANCE_POLICY.cooldownMs
          : liveState.system.performance?.tierCooldownUntil ?? null;
        const performanceTierUpdatedAt = tierChanged
          ? nowIso()
          : liveState.system.performance?.performanceTierUpdatedAt ?? null;
        const tierDecisionReason = tierChanged ? "manual_set_tier" : "manual_set_tier_noop";
        return finalize(
          updateState(
            {
              ...liveState,
              system: {
                ...liveState.system,
                performanceTier: nextTier,
                performance: {
                  ...liveState.system.performance,
                  lastDegradeReason: payload.reason ?? "manual",
                  tierDecisionReason,
                  tierCooldownUntil,
                  tierCooldownRemainingMs: Math.max(0, Number(tierCooldownUntil ?? 0) - nowMs),
                  performanceTierUpdatedAt,
                  belowThresholdCount: 0,
                  aboveThresholdCount: 0,
                  updatedAt: nowIso(),
                },
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "runtime_report_performance") {
        const avgFps = payload.avgFps ?? liveState.system.performance?.avgFps ?? null;
        const numericAvgFps =
          avgFps === null || avgFps === undefined || avgFps === ""
            ? Number.NaN
            : Number(avgFps);
        const nowMs = Date.now();
        const decision = deriveTierDecision({
          avgFps: numericAvgFps,
          payloadTier: payload.tier,
          liveState,
          policy: PERFORMANCE_POLICY,
          nowMs,
        });

        const nextTier = normalizePerformanceTier(decision.nextTier);
        recordPerformanceSample({
          ...payload,
          avgFps,
          tier: nextTier,
          tierChanged: decision.tierChanged,
          tierDecisionReason: decision.decisionReason,
          tierCooldownUntil: decision.tierCooldownUntil,
          tierCooldownRemainingMs: decision.tierCooldownRemainingMs,
          source,
        });

        return finalize(
          updateState(
            {
              ...liveState,
              system: {
                ...liveState.system,
                performanceTier: nextTier,
                performance: {
                  ...liveState.system.performance,
                  avgFps,
                  temperatureC: payload.temperatureC ?? liveState.system.performance?.temperatureC ?? null,
                  interactionLatencyMs: payload.interactionLatencyMs ?? liveState.system.performance?.interactionLatencyMs ?? null,
                  memoryUsageMb: payload.memoryUsageMb ?? liveState.system.performance?.memoryUsageMb ?? null,
                  lastDegradeReason: payload.reason ?? liveState.system.performance?.lastDegradeReason ?? null,
                  rendererType: payload.rendererType ?? liveState.system.performance?.rendererType ?? "image",
                  requestedRenderer: payload.requestedRenderer ?? liveState.system.performance?.requestedRenderer ?? "image",
                  chromiumExperiment: payload.chromiumExperiment ?? liveState.system.performance?.chromiumExperiment ?? "baseline",
                  rendererFallbackCount: payload.rendererFallbackCount ?? liveState.system.performance?.rendererFallbackCount ?? 0,
                  glInitErrorCount: payload.glInitErrorCount ?? liveState.system.performance?.glInitErrorCount ?? 0,
                  glContextLostCount: payload.glContextLostCount ?? liveState.system.performance?.glContextLostCount ?? 0,
                  rendererFallbackReason:
                    Object.prototype.hasOwnProperty.call(payload, "rendererFallbackReason")
                      ? payload.rendererFallbackReason
                      : liveState.system.performance?.rendererFallbackReason ?? null,
                  tierDecisionReason: decision.decisionReason,
                  tierCooldownUntil: decision.tierCooldownUntil,
                  tierCooldownRemainingMs: decision.tierCooldownRemainingMs,
                  performanceTierUpdatedAt: decision.performanceTierUpdatedAt,
                  belowThresholdCount: decision.belowThresholdCount,
                  aboveThresholdCount: decision.aboveThresholdCount,
                  updatedAt: nowIso(),
                },
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "ota_check") {
        const currentVersion = liveState.system.ota?.currentVersion ?? liveState.system.version;
        const targetVersion = payload.targetVersion ?? "0.1.1";
        const managerResult = otaManager?.check?.({ currentVersion, targetVersion });
        const updateAvailable = managerResult?.updateAvailable ?? currentVersion !== targetVersion;

        return finalize(
          updateState(
            {
              ...liveState,
              system: {
                ...liveState.system,
                otaStatus: updateAvailable ? "available" : "idle",
                ota: {
                  ...liveState.system.ota,
                  currentVersion,
                  targetVersion,
                  updateAvailable,
                  canRollback: Boolean(liveState.system.ota?.canRollback),
                  restartRequired: false,
                  lastCheckedAt: nowIso(),
                  lastErrorCode: null,
                  lastOperation: {
                    type,
                    status: "completed",
                    phases: managerResult?.phases ?? ["checking", updateAvailable ? "available" : "idle"],
                    releasePath: managerResult?.releasePath ?? null,
                    manifestPath: managerResult?.manifestPath ?? null,
                    manifest: managerResult?.manifest ?? null,
                    updatedAt: nowIso(),
                  },
                },
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "ota_apply") {
        if (["applying", "restarting", "rollback"].includes(liveState.system.otaStatus)) {
          throw createRejectedError("OTA_IN_PROGRESS", "OTA is already applying or rolling back");
        }

        const currentVersion = liveState.system.ota?.currentVersion ?? liveState.system.version;
        const targetVersion = payload.targetVersion ?? liveState.system.ota?.targetVersion;
        if (!targetVersion || targetVersion === currentVersion) {
          throw createRejectedError("NO_UPDATE_AVAILABLE", "No OTA update is available to apply");
        }

        const appliedAt = nowIso();
        const managerResult = otaManager?.apply?.({ currentVersion, targetVersion });
        const releasePath =
          managerResult?.releasePath ?? `${liveState.system.ota?.releaseRoot ?? "/opt/tikpal/app/releases"}/${targetVersion}`;
        const previousVersion = managerResult?.previousVersion ?? currentVersion;
        const nextCurrentVersion = managerResult?.currentVersion ?? targetVersion;
        return finalize(
          updateState(
            {
              ...liveState,
              system: {
                ...liveState.system,
                version: nextCurrentVersion,
                otaStatus: "idle",
                ota: {
                  ...liveState.system.ota,
                  currentVersion: nextCurrentVersion,
                  previousVersion,
                  targetVersion: managerResult?.targetVersion ?? targetVersion,
                  updateAvailable: false,
                  canRollback: true,
                  restartRequired: false,
                  lastAppliedAt: appliedAt,
                  lastRestartedAt: appliedAt,
                  lastHealthCheckAt: appliedAt,
                  lastErrorCode: null,
                  lastOperation: {
                    type,
                    status: "completed",
                    phases: managerResult?.phases ?? ["downloading", "verifying", "applying", "restarting", "health_check", "completed"],
                    releasePath,
                    manifestPath: managerResult?.manifestPath ?? null,
                    manifest: managerResult?.manifest ?? null,
                    restart: managerResult?.restart ?? null,
                    health: managerResult?.health ?? null,
                    updatedAt: appliedAt,
                  },
                },
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "ota_rollback") {
        if (["applying", "restarting", "rollback"].includes(liveState.system.otaStatus)) {
          throw createRejectedError("OTA_IN_PROGRESS", "OTA is already applying or rolling back");
        }

        const currentVersion = liveState.system.ota?.currentVersion ?? liveState.system.version;
        const previousVersion = payload.targetVersion ?? liveState.system.ota?.previousVersion;
        if (!liveState.system.ota?.canRollback || !previousVersion) {
          throw createRejectedError("ROLLBACK_UNAVAILABLE", "No OTA rollback target is available");
        }

        const rolledBackAt = nowIso();
        const managerResult = otaManager?.rollback?.({ currentVersion, previousVersion });
        const nextCurrentVersion = managerResult?.currentVersion ?? previousVersion;
        const nextPreviousVersion = managerResult?.previousVersion ?? currentVersion;
        const releasePath =
          managerResult?.releasePath ?? `${liveState.system.ota?.releaseRoot ?? "/opt/tikpal/app/releases"}/${previousVersion}`;
        return finalize(
          updateState(
            {
              ...liveState,
              system: {
                ...liveState.system,
                version: nextCurrentVersion,
                otaStatus: "idle",
                ota: {
                  ...liveState.system.ota,
                  currentVersion: nextCurrentVersion,
                  previousVersion: nextPreviousVersion,
                  targetVersion: managerResult?.targetVersion ?? null,
                  updateAvailable: false,
                  canRollback: false,
                  restartRequired: false,
                  lastRolledBackAt: rolledBackAt,
                  lastRestartedAt: rolledBackAt,
                  lastHealthCheckAt: rolledBackAt,
                  lastErrorCode: null,
                  lastOperation: {
                    type,
                    status: "completed",
                    phases: managerResult?.phases ?? ["rollback", "restarting", "health_check", "completed"],
                    releasePath,
                    manifestPath: managerResult?.manifestPath ?? null,
                    manifest: managerResult?.manifest ?? null,
                    restart: managerResult?.restart ?? null,
                    health: managerResult?.health ?? null,
                    updatedAt: rolledBackAt,
                  },
                },
              },
            },
            source,
            type,
          ),
        );
      }

      throw createRejectedError("UNKNOWN_ACTION", `Unsupported action: ${type}`);
    } catch (error) {
      recordOtaFailure(error);
      recordActionLog({
        timestamp,
        source,
        actionType: type,
        payloadSummary: summarizeActionPayload(type, payload),
        result: "rejected",
        errorCode: error.code ?? "UNKNOWN_ERROR",
        durationMs: Date.now() - startedAtMs,
      });
      throw error;
    }
  }

  function createSession(payload = {}, source = "portable_controller") {
    cleanupExpiredSessions();
    const id = `ctrl_${Math.random().toString(36).slice(2, 10)}`;
    const role = normalizeRole(payload.role ?? "controller");
    const ttlSec = clamp(Number(payload.ttlSec ?? DEFAULT_SESSION_TTL_SEC), 0, MAX_SESSION_TTL_SEC);
    const session = {
      id,
      deviceId: payload.deviceId ?? id,
      name: payload.name ?? "Tikpal Portable Controller",
      role,
      scopes: payload.scopes ?? ROLE_SCOPES[role],
      capabilities: payload.capabilities ?? [],
      token: createSessionToken(),
      source,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
      lastSeenAt: null,
      revoked: false,
    };
    sessions.set(id, session);
    sessionIdsByToken.set(session.token, id);
    updateState(state, source);
    persistNow();
    return sanitizeSession(session, { includeToken: true });
  }

  function createPairingCode(payload = {}, source = "system") {
    cleanupExpiredPairingCodes();
    const ttlSec = clamp(Number(payload.ttlSec ?? DEFAULT_PAIRING_TTL_SEC), 0, MAX_PAIRING_TTL_SEC);
    let code = createPairingCodeValue();
    while (pairingCodes.has(code)) {
      code = createPairingCodeValue();
    }

    const pairing = {
      code,
      role: normalizeRole(payload.role ?? "controller"),
      capabilities: payload.capabilities ?? [],
      scopes: payload.scopes ?? null,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
      createdBy: source,
      claimedAt: null,
    };
    pairingCodes.set(code, pairing);
    persistNow();
    return structuredClone(pairing);
  }

  function claimPairingCode(code, payload = {}, source = "portable_controller") {
    cleanupExpiredPairingCodes();
    const pairing = pairingCodes.get(code);
    if (!pairing) {
      throw createRejectedError("PAIRING_CODE_INVALID", "Pairing code is invalid or expired");
    }

    pairing.claimedAt = nowIso();
    pairingCodes.delete(code);
    persistNow();
    return createSession(
      {
        deviceId: payload.deviceId,
        name: payload.name,
        role: pairing.role,
        scopes: pairing.scopes ?? undefined,
        capabilities: payload.capabilities ?? pairing.capabilities,
        ttlSec: payload.ttlSec,
      },
      source,
    );
  }

  function getSession(id) {
    cleanupExpiredSessions();
    return sanitizeSession(sessions.get(id) ?? null);
  }

  function getSessionByToken(token, { touch = true } = {}) {
    cleanupExpiredSessions();
    const sessionId = sessionIdsByToken.get(token);
    if (!sessionId) {
      return null;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      sessionIdsByToken.delete(token);
      syncControllerCount();
      return null;
    }

    if (touch) {
      session.lastSeenAt = nowIso();
      persistNow();
    }

    return sanitizeSession(session);
  }

  function deleteSession(id) {
    const deleted = removeSession(id);
    if (deleted) {
      updateState(state, "system", "delete_session");
    }
    return deleted;
  }

  function getRequiredRoleForAction(type) {
    return ACTION_ROLE_REQUIREMENTS[type] ?? null;
  }

  return {
    getSnapshot,
    getCapabilities,
    getRequiredRoleForAction,
    hasRequiredRole,
    getRuntimeSummary() {
      const liveState = getNormalizedState();
      return {
        ...summarizeRuntimeState(liveState),
        controllerCount: liveState.controller?.activeSessionCount ?? 0,
        playbackSource: liveState.playback?.source ?? null,
        playbackVolume: liveState.playback?.volume ?? null,
        screenSyncStale: Boolean(liveState.screen?.sync?.stale),
        renderProfile: liveState.system?.renderProfile ?? "off",
        flowDiagnosticMode: liveState.system?.flowDiagnosticMode ?? "off",
        avgFps: liveState.system?.performance?.avgFps ?? null,
        rendererType: liveState.system?.performance?.rendererType ?? "image",
        requestedRenderer: liveState.system?.performance?.requestedRenderer ?? "image",
        chromiumExperiment: liveState.system?.performance?.chromiumExperiment ?? "baseline",
        rendererFallbackCount: liveState.system?.performance?.rendererFallbackCount ?? 0,
        glInitErrorCount: liveState.system?.performance?.glInitErrorCount ?? 0,
        glContextLostCount: liveState.system?.performance?.glContextLostCount ?? 0,
        rendererFallbackReason: liveState.system?.performance?.rendererFallbackReason ?? null,
        temperatureC: liveState.system?.performance?.temperatureC ?? null,
        interactionLatencyMs: liveState.system?.performance?.interactionLatencyMs ?? null,
        memoryUsageMb: liveState.system?.performance?.memoryUsageMb ?? null,
        lastDegradeReason: liveState.system?.performance?.lastDegradeReason ?? null,
        tierDecisionReason: liveState.system?.performance?.tierDecisionReason ?? null,
        tierCooldownUntil: liveState.system?.performance?.tierCooldownUntil ?? null,
        tierCooldownRemainingMs: Math.max(
          0,
          Number(liveState.system?.performance?.tierCooldownUntil ?? 0) - Date.now(),
        ),
        performanceTierUpdatedAt: liveState.system?.performance?.performanceTierUpdatedAt ?? null,
        ota: liveState.system?.ota ?? null,
        lastUpdatedAt: liveState.lastUpdatedAt ?? null,
      };
    },
    getRuntimeProfile() {
      const liveState = getNormalizedState();
      return {
        ...getRuntimeProfileConfig(liveState.system?.renderProfile ?? "off", liveState.system?.performanceTier ?? "normal"),
        flowDiagnosticMode: liveState.system?.flowDiagnosticMode ?? "off",
        rendererType: liveState.system?.performance?.rendererType ?? "image",
        requestedRenderer: liveState.system?.performance?.requestedRenderer ?? "image",
        chromiumExperiment: liveState.system?.performance?.chromiumExperiment ?? "baseline",
        rendererFallbackReason: liveState.system?.performance?.rendererFallbackReason ?? null,
      };
    },
    getActionLogs(limit = 50) {
      const normalizedLimit = clamp(Number(limit ?? 50), 1, MAX_RUNTIME_LOG_ENTRIES);
      return actionLogs.slice(-normalizedLimit).reverse();
    },
    getStateTransitionLogs(limit = 50) {
      const normalizedLimit = clamp(Number(limit ?? 50), 1, MAX_RUNTIME_LOG_ENTRIES);
      return stateTransitionLogs.slice(-normalizedLimit).reverse();
    },
    getPerformanceSamples(limit = 50) {
      const normalizedLimit = clamp(Number(limit ?? 50), 1, MAX_RUNTIME_LOG_ENTRIES);
      return performanceSamples.slice(-normalizedLimit).reverse();
    },
    getFlowSnapshot() {
      return toFlowSnapshot(state);
    },
    patchFlowState,
    patchPlaybackState,
    patchIntegration,
    getIntegrationStatuses,
    hasIntegrationCredential,
    getIntegrationCredential,
    bindIntegration,
    updateIntegrationCredential,
    revokeIntegration,
    runAction,
    runFlowAction,
    createSession,
    createPairingCode,
    claimPairingCode,
    getSession,
    getSessionByToken,
    deleteSession,
  };
}
