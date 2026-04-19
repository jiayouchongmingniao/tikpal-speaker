const MODE_ORDER = ["listen", "flow", "screen"];
const FLOW_ORDER = ["focus", "flow", "relax", "sleep"];

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
    },
    overlay: {
      state: "hidden",
      reason: null,
      visible: false,
    },
    playback: {
      state: "play",
      volume: 58,
      trackTitle: "Low Light Corridor",
      artist: "tikpal",
      album: "Mock Session",
      source: "Mock Stream",
      progress: 0.63,
      format: "FLAC 24/96",
      nextTrackTitle: "Night Window",
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
    const activeMode = mode === "overview" ? "overview" : mode;
    const focusedPanel = mode === "overview" ? null : mode;
    return updateState(
      {
        ...state,
        activeMode,
        focusedPanel,
        transition: {
          status: "idle",
          from: state.activeMode,
          to: activeMode,
          startedAt: nowIso(),
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
    return state;
  }

  function patchFlowState(patch, source = "remote-client") {
    const nextPlayback = patch.playerState
      ? {
          ...state.playback,
          state: patch.playerState.playbackState ?? state.playback.state,
          volume: patch.playerState.volume ?? state.playback.volume,
          trackTitle: patch.playerState.trackTitle ?? state.playback.trackTitle,
          artist: patch.playerState.artist ?? state.playback.artist,
          source: patch.playerState.source ?? state.playback.source,
          progress: patch.playerState.progress ?? state.playback.progress,
        }
      : state.playback;

    const nextFlow = {
      ...state.flow,
      state: patch.currentState ?? state.flow.state,
      subtitle: deriveFlowSubtitle(patch.currentState ?? state.flow.state),
      audioMetrics: {
        ...state.flow.audioMetrics,
        ...(patch.audioMetrics ?? {}),
      },
    };

    updateState(
      {
        ...state,
        activeMode: "flow",
        focusedPanel: "flow",
        overlay: {
          ...state.overlay,
          visible: patch.uiVisible ?? state.overlay.visible,
          state: (patch.uiVisible ?? state.overlay.visible) ? "controls" : "hidden",
        },
        playback: nextPlayback,
        flow: nextFlow,
      },
      source,
    );

    return toFlowSnapshot(state);
  }

  function runFlowAction(type, payload = {}, source = "remote-client") {
    if (type === "set_state") {
      runAction("set_flow_state", { state: payload.state }, source);
      return toFlowSnapshot(state);
    }

    if (type === "next_state") {
      const currentIndex = FLOW_ORDER.indexOf(state.flow.state);
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
    if (state.system.otaStatus === "applying" && !type.startsWith("ota_")) {
      const error = new Error("OTA is in progress");
      error.code = "OTA_IN_PROGRESS";
      throw error;
    }

    if (type === "set_mode") {
      return setMode(payload.mode ?? "overview", source);
    }

    if (type === "return_overview") {
      return setMode("overview", source);
    }

    if (type === "show_controls") {
      return updateState(
        {
          ...state,
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
          ...state,
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
      const nextPlaybackState = state.playback.state === "play" ? "pause" : "play";
      return updateState(
        {
          ...state,
          playback: {
            ...state.playback,
            state: nextPlaybackState,
          },
          flow: {
            ...state.flow,
            audioMetrics: {
              ...state.flow.audioMetrics,
              isPlaying: nextPlaybackState === "play",
            },
          },
        },
        source,
      );
    }

    if (type === "set_volume") {
      const volume = clamp(Number(payload.volume ?? state.playback.volume), 0, 100);
      return updateState(
        {
          ...state,
          playback: {
            ...state.playback,
            volume,
          },
          flow: {
            ...state.flow,
            audioMetrics: {
              ...state.flow.audioMetrics,
              volumeNormalized: volume / 100,
            },
          },
        },
        source,
      );
    }

    if (type === "set_flow_state") {
      const nextFlowState = FLOW_ORDER.includes(payload.state) ? payload.state : state.flow.state;
      return updateState(
        {
          ...state,
          activeMode: "flow",
          focusedPanel: "flow",
          flow: {
            ...state.flow,
            state: nextFlowState,
            subtitle: deriveFlowSubtitle(nextFlowState),
          },
        },
        source,
      );
    }

    if (type === "screen_start_pomodoro") {
      const durationSec = clamp(Number(payload.durationSec ?? 1500), 60, 7200);
      return updateState(
        {
          ...state,
          activeMode: "screen",
          focusedPanel: "screen",
          screen: {
            ...state.screen,
            pomodoroState: "running",
            pomodoroDurationSec: durationSec,
            pomodoroRemainingSec: durationSec,
          },
        },
        source,
      );
    }

    if (type === "screen_pause_pomodoro") {
      return updateState(
        {
          ...state,
          screen: {
            ...state.screen,
            pomodoroState: "paused",
          },
        },
        source,
      );
    }

    if (type === "screen_reset_pomodoro") {
      return updateState(
        {
          ...state,
          screen: {
            ...state.screen,
            pomodoroState: "idle",
            pomodoroRemainingSec: state.screen.pomodoroDurationSec,
          },
        },
        source,
      );
    }

    if (type === "screen_complete_current_task") {
      return updateState(
        {
          ...state,
          screen: {
            ...state.screen,
            currentTask: state.screen.nextTask,
            nextTask: "Plan next session",
            todaySummary: {
              ...state.screen.todaySummary,
              remainingTasks: Math.max(0, state.screen.todaySummary.remainingTasks - 1),
            },
          },
        },
        source,
      );
    }

    if (type === "screen_set_focus_item") {
      return updateState(
        {
          ...state,
          activeMode: "screen",
          focusedPanel: "screen",
          screen: {
            ...state.screen,
            currentTask: payload.title ?? state.screen.currentTask,
          },
        },
        source,
      );
    }

    return state;
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
