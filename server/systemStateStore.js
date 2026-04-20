const MODE_ORDER = ["listen", "flow", "screen"];
const FLOW_ORDER = ["focus", "flow", "relax", "sleep"];
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

function getQueueTrack(index) {
  return MOCK_QUEUE[(index + MOCK_QUEUE.length) % MOCK_QUEUE.length];
}

function getAdjacentMode(currentMode, direction = 1) {
  const normalizedMode = currentMode === "overview" ? "listen" : currentMode;
  const currentIndex = MODE_ORDER.indexOf(normalizedMode);
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (baseIndex + direction + MODE_ORDER.length) % MODE_ORDER.length;
  return MODE_ORDER[nextIndex];
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
      subtitle: "Deep Work",
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
      pomodoroDurationSec: 1500,
      pomodoroRemainingSec: 1124,
      timerUpdatedAt: nowIso(),
      todaySummary: {
        remainingTasks: 3,
        remainingEvents: 2,
      },
      sync: {
        status: "mock",
        stale: false,
      },
    },
    integrations: {
      calendar: {
        connected: false,
        status: "unconfigured",
      },
      todoist: {
        connected: false,
        status: "unconfigured",
      },
    },
    controller: {
      activeSessionCount: 0,
    },
    system: {
      version: process.env.npm_package_version ?? "0.1.0",
      otaStatus: "idle",
      performanceTier: "normal",
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
    return "Deep Work";
  }

  if (flowState === "relax") {
    return "Wind Down";
  }

  if (flowState === "sleep") {
    return "Night Drift";
  }

  return "Motion Loop";
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

  function getNormalizedState() {
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

  function updateState(nextState, source = state.lastSource) {
    state = {
      ...nextState,
      controller: {
        ...nextState.controller,
        activeSessionCount: sessions.size,
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
    return state;
  }

  function setMode(mode, source) {
    const liveState = getNormalizedState();
    const activeMode = mode === "overview" ? "overview" : mode;
    const focusedPanel = mode === "overview" ? null : mode;
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
          lockedUntil: Date.now() + 520,
        },
      },
      source,
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
    );

    return toFlowSnapshot(state);
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

    if (liveState.system.otaStatus === "applying" && !type.startsWith("ota_")) {
      const error = new Error("OTA is in progress");
      error.code = "OTA_IN_PROGRESS";
      throw error;
    }

    if (
      liveState.transition.status !== "idle" &&
      ["set_mode", "return_overview", "set_flow_state"].includes(type)
    ) {
      return liveState;
    }

    if (type === "set_mode") {
      return setMode(payload.mode ?? "overview", source);
    }

    if (type === "return_overview") {
      return setMode("overview", source);
    }

    if (type === "next_mode") {
      return setMode(getAdjacentMode(liveState.activeMode, 1), source);
    }

    if (type === "prev_mode") {
      return setMode(getAdjacentMode(liveState.activeMode, -1), source);
    }

    if (type === "show_controls") {
      return updateState(
        {
          ...liveState,
          overlay: {
            state: "controls",
            reason: payload.reason ?? "user",
            visible: true,
          },
        },
        source,
      );
    }

    if (type === "hide_controls") {
      return updateState(
        {
          ...liveState,
          overlay: {
            state: "hidden",
            reason: null,
            visible: false,
          },
        },
        source,
      );
    }

    if (type === "toggle_play") {
      const nextPlaybackState = liveState.playback.state === "play" ? "pause" : "play";
      return updateState(
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
      );
    }

    if (type === "prev_track" || type === "next_track") {
      const step = type === "next_track" ? 1 : -1;
      const nextIndex = (Number(liveState.playback.currentTrackIndex ?? 0) + step + MOCK_QUEUE.length) % MOCK_QUEUE.length;
      return updateState(
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
      );
    }

    if (type === "set_volume") {
      const volume = clamp(Number(payload.volume ?? liveState.playback.volume), 0, 100);
      return updateState(
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
      );
    }

    if (type === "set_flow_state") {
      const nextFlowState = FLOW_ORDER.includes(payload.state) ? payload.state : liveState.flow.state;
      return updateState(
        {
          ...liveState,
          activeMode: "flow",
          focusedPanel: "flow",
          transition: {
            status: "animating",
            from: liveState.activeMode,
            to: "flow",
            startedAt: nowIso(),
            lockedUntil: Date.now() + 420,
          },
          flow: {
            ...liveState.flow,
            state: nextFlowState,
            subtitle: deriveFlowSubtitle(nextFlowState),
          },
        },
        source,
      );
    }

    if (type === "screen_start_pomodoro") {
      const durationSec = clamp(Number(payload.durationSec ?? liveState.screen.pomodoroDurationSec ?? 1500), 60, 7200);
      return updateState(
        {
          ...liveState,
          activeMode: "screen",
          focusedPanel: "screen",
          screen: {
            ...liveState.screen,
            pomodoroState: "running",
            pomodoroDurationSec: durationSec,
            pomodoroRemainingSec: durationSec,
            timerUpdatedAt: nowIso(),
          },
        },
        source,
      );
    }

    if (type === "screen_resume_pomodoro") {
      return updateState(
        {
          ...liveState,
          screen: {
            ...liveState.screen,
            pomodoroState: "running",
            timerUpdatedAt: nowIso(),
          },
        },
        source,
      );
    }

    if (type === "screen_pause_pomodoro") {
      return updateState(
        {
          ...liveState,
          screen: {
            ...liveState.screen,
            pomodoroState: "paused",
            timerUpdatedAt: nowIso(),
          },
        },
        source,
      );
    }

    if (type === "screen_reset_pomodoro") {
      return updateState(
        {
          ...liveState,
          screen: {
            ...liveState.screen,
            pomodoroState: "idle",
            pomodoroRemainingSec: liveState.screen.pomodoroDurationSec,
            timerUpdatedAt: nowIso(),
          },
        },
        source,
      );
    }

    if (type === "screen_complete_current_task") {
      return updateState(
        {
          ...liveState,
          screen: {
            ...liveState.screen,
            currentTask: liveState.screen.nextTask,
            nextTask: "Plan next session",
            todaySummary: {
              ...liveState.screen.todaySummary,
              remainingTasks: Math.max(0, liveState.screen.todaySummary.remainingTasks - 1),
            },
          },
        },
        source,
      );
    }

    if (type === "screen_set_focus_item") {
      return updateState(
        {
          ...liveState,
          activeMode: "screen",
          focusedPanel: "screen",
          screen: {
            ...liveState.screen,
            currentTask: payload.title ?? liveState.screen.currentTask,
          },
        },
        source,
      );
    }

    return liveState;
  }

  function createSession(payload = {}, source = "portable_controller") {
    const id = `ctrl_${Math.random().toString(36).slice(2, 10)}`;
    const session = {
      id,
      deviceId: payload.deviceId ?? id,
      name: payload.name ?? "Tikpal Portable Controller",
      capabilities: payload.capabilities ?? [],
      source,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    sessions.set(id, session);
    updateState(state, source);
    return session;
  }

  function getSession(id) {
    return sessions.get(id) ?? null;
  }

  function deleteSession(id) {
    const deleted = sessions.delete(id);
    if (deleted) {
      updateState(state, "system");
    }
    return deleted;
  }

  return {
    getSnapshot,
    getCapabilities,
    getFlowSnapshot() {
      return toFlowSnapshot(state);
    },
    patchFlowState,
    runAction,
    runFlowAction,
    createSession,
    getSession,
    deleteSession,
  };
}
