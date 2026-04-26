const MODE_ORDER = ["listen", "flow", "screen"];
const FLOW_ORDER = ["focus", "flow", "relax", "sleep"];
const CREATIVE_CARE_MOODS = ["clear", "scattered", "stuck", "tired", "calm", "energized"];
const CREATIVE_CARE_MODES = ["focus", "flow", "unwind", "sleep"];
const MODE_TRANSITION_MS = 280;
const FLOW_TRANSITION_MS = 220;
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

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
    pomodoroState: state.screen?.pomodoroState ?? null,
    screenTask: state.screen?.currentTask ?? null,
    creativeMood: state.creativeCare?.moodLabel ?? null,
    creativeCareMode: state.creativeCare?.currentCareMode ?? null,
    creativeFlowSuggestion: state.creativeCare?.suggestedFlowState ?? null,
    performanceTier: state.system?.performanceTier ?? null,
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
      currentTrackIndex: 0,
      queueLength: MOCK_QUEUE.length,
      ...getQueueTrack(0),
    },
    flow: {
      state: "focus",
      subtitle: "Steady the next thought",
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
      performance: {
        avgFps: 60,
        temperatureC: null,
        interactionLatencyMs: null,
        memoryUsageMb: null,
        lastDegradeReason: null,
        updatedAt: nowIso(),
      },
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

export function createSystemStateStore() {
  let state = createInitialState();
  const sessions = new Map();
  const sessionIdsByToken = new Map();
  const pairingCodes = new Map();
  const connectorCredentials = new Map();
  const actionLogs = [];
  const stateTransitionLogs = [];

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
    for (const [code, pairing] of pairingCodes.entries()) {
      if ((pairing.expiresAt && new Date(pairing.expiresAt).getTime() <= Date.now()) || pairing.claimedAt) {
        pairingCodes.delete(code);
      }
    }
  }

  function getNormalizedState() {
    cleanupExpiredSessions();
    const normalizedTransition = normalizeTransition(state.transition);
    const normalizedScreen = normalizeScreenTimer(state.screen);
    if (normalizedTransition !== state.transition || normalizedScreen !== state.screen) {
      state = {
        ...state,
        transition: normalizedTransition,
        screen: normalizedScreen,
      };
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
      touch: {
        multiTouch: true,
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

  function bindIntegration(name, payload = {}, source = "admin_client") {
    if (!CONNECTOR_NAMES.includes(name)) {
      throw createRejectedError("INVALID_CONNECTOR", `Unsupported connector: ${name}`);
    }

    const authUpdatedAt = nowIso();
    const credentialRef = `local:${name}:${payload.accountLabel ?? "default"}`;
    connectorCredentials.set(name, {
      provider: name,
      accountLabel: payload.accountLabel ?? `${name}.local`,
      accessToken: payload.accessToken ?? null,
      refreshToken: payload.refreshToken ?? null,
      tokenExpiresAt: payload.tokenExpiresAt ?? null,
      metadata: payload.metadata ?? {},
      createdAt: connectorCredentials.get(name)?.createdAt ?? authUpdatedAt,
      updatedAt: authUpdatedAt,
    });

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

    try {
      if (liveState.system.otaStatus === "applying" && !type.startsWith("ota_")) {
        const error = new Error("OTA is in progress");
        error.code = "OTA_IN_PROGRESS";
        throw error;
      }

      if (
        liveState.transition.status !== "idle" &&
        ["set_mode", "return_overview", "set_flow_state", "next_mode", "prev_mode"].includes(type)
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
        const nextPlaybackState = liveState.playback.state === "play" ? "pause" : "play";
        return finalize(
          updateState(
            {
              ...liveState,
              playback: {
                ...liveState.playback,
                state: nextPlaybackState,
              },
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
        const nextIndex = (Number(liveState.playback.currentTrackIndex ?? 0) + step + MOCK_QUEUE.length) % MOCK_QUEUE.length;
        return finalize(
          updateState(
            {
              ...liveState,
              playback: {
                ...liveState.playback,
                currentTrackIndex: nextIndex,
                queueLength: MOCK_QUEUE.length,
                ...getQueueTrack(nextIndex),
              },
            },
            source,
            type,
          ),
        );
      }

      if (type === "set_volume") {
        const volume = clamp(Number(payload.volume ?? liveState.playback.volume), 0, 100);
        return finalize(
          updateState(
            {
              ...liveState,
              playback: {
                ...liveState.playback,
                volume,
              },
              flow: {
                ...liveState.flow,
                audioMetrics: {
                  ...liveState.flow.audioMetrics,
                  volumeNormalized: volume / 100,
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
              },
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
        const nextTier = ["normal", "reduced", "safe"].includes(payload.tier) ? payload.tier : liveState.system.performanceTier;
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
        const nextTier =
          payload.tier ??
          (typeof avgFps === "number"
            ? avgFps < 24
              ? "safe"
              : avgFps < 30
                ? "reduced"
                : "normal"
            : liveState.system.performanceTier);

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
        const updateAvailable = currentVersion !== targetVersion;

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
                    phases: ["checking", updateAvailable ? "available" : "idle"],
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
        return finalize(
          updateState(
            {
              ...liveState,
              system: {
                ...liveState.system,
                version: targetVersion,
                otaStatus: "idle",
                ota: {
                  ...liveState.system.ota,
                  currentVersion: targetVersion,
                  previousVersion: currentVersion,
                  targetVersion,
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
                    phases: ["downloading", "verifying", "applying", "restarting", "health_check", "completed"],
                    releasePath: `${liveState.system.ota?.releaseRoot ?? "/opt/tikpal/app/releases"}/${targetVersion}`,
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
        return finalize(
          updateState(
            {
              ...liveState,
              system: {
                ...liveState.system,
                version: previousVersion,
                otaStatus: "idle",
                ota: {
                  ...liveState.system.ota,
                  currentVersion: previousVersion,
                  previousVersion: currentVersion,
                  targetVersion: null,
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
                    phases: ["rollback", "restarting", "health_check", "completed"],
                    releasePath: `${liveState.system.ota?.releaseRoot ?? "/opt/tikpal/app/releases"}/${previousVersion}`,
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
        avgFps: liveState.system?.performance?.avgFps ?? null,
        temperatureC: liveState.system?.performance?.temperatureC ?? null,
        interactionLatencyMs: liveState.system?.performance?.interactionLatencyMs ?? null,
        memoryUsageMb: liveState.system?.performance?.memoryUsageMb ?? null,
        lastDegradeReason: liveState.system?.performance?.lastDegradeReason ?? null,
        ota: liveState.system?.ota ?? null,
        lastUpdatedAt: liveState.lastUpdatedAt ?? null,
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
    getFlowSnapshot() {
      return toFlowSnapshot(state);
    },
    patchFlowState,
    patchIntegration,
    getIntegrationStatuses,
    hasIntegrationCredential,
    bindIntegration,
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
