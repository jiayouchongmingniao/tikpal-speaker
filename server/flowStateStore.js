const FLOW_ORDER = ["focus", "flow", "relax", "sleep"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function now() {
  return new Date().toISOString();
}

function nextStateInDirection(currentState, dir) {
  const currentIndex = FLOW_ORDER.indexOf(currentState);
  const step = dir === "left" ? -1 : 1;
  const nextIndex = (currentIndex + step + FLOW_ORDER.length) % FLOW_ORDER.length;
  return FLOW_ORDER[nextIndex];
}

export function createFlowStateStore() {
  const sessions = new Map();

  let snapshot = {
    currentState: "focus",
    uiVisible: true,
    appPhase: "booting",
    playerState: {
      playbackState: "play",
      volume: 58,
      trackTitle: "Low Light Corridor",
      artist: "tikpal",
      source: "Speaker Service",
      progress: 0.32,
    },
    audioMetrics: {
      volumeNormalized: 0.58,
      lowEnergy: 0.28,
      midEnergy: 0.22,
      highEnergy: 0.18,
      beatConfidence: 0.12,
      isPlaying: true,
    },
    updatedAt: now(),
    lastSource: "speaker-service",
  };

  function touch(source = "speaker-service") {
    snapshot = {
      ...snapshot,
      updatedAt: now(),
      lastSource: source,
    };
  }

  function getSnapshot() {
    return structuredClone(snapshot);
  }

  function patchState(patch, source = "speaker-service") {
    snapshot = {
      ...snapshot,
      ...patch,
      playerState: patch.playerState ? { ...snapshot.playerState, ...patch.playerState } : snapshot.playerState,
      audioMetrics: patch.audioMetrics ? { ...snapshot.audioMetrics, ...patch.audioMetrics } : snapshot.audioMetrics,
    };
    touch(source);
    return getSnapshot();
  }

  function runAction(type, payload = {}, source = "speaker-service") {
    switch (type) {
      case "toggle_play": {
        snapshot.playerState.playbackState =
          snapshot.playerState.playbackState === "play" ? "pause" : "play";
        snapshot.audioMetrics.isPlaying = snapshot.playerState.playbackState === "play";
        break;
      }
      case "set_volume": {
        const volume = clamp(Number(payload.volume ?? snapshot.playerState.volume), 0, 100);
        snapshot.playerState.volume = volume;
        snapshot.audioMetrics.volumeNormalized = volume / 100;
        break;
      }
      case "show_controls": {
        snapshot.uiVisible = true;
        snapshot.appPhase = "controls_visible";
        break;
      }
      case "hide_controls": {
        snapshot.uiVisible = false;
        snapshot.appPhase = snapshot.currentState === "sleep" ? "sleep_dimmed" : "immersive";
        break;
      }
      case "next_state": {
        snapshot.currentState = nextStateInDirection(snapshot.currentState, payload.dir);
        snapshot.appPhase = "transitioning";
        break;
      }
      case "set_state": {
        if (FLOW_ORDER.includes(payload.state)) {
          snapshot.currentState = payload.state;
          snapshot.appPhase = payload.state === "sleep" ? "idle_preview" : "transitioning";
        }
        break;
      }
      case "set_track": {
        snapshot.playerState = {
          ...snapshot.playerState,
          trackTitle: payload.trackTitle ?? snapshot.playerState.trackTitle,
          artist: payload.artist ?? snapshot.playerState.artist,
          source: payload.source ?? snapshot.playerState.source,
          progress: clamp(Number(payload.progress ?? snapshot.playerState.progress), 0, 1),
        };
        break;
      }
      default: {
        throw new Error(`Unsupported action type: ${type}`);
      }
    }

    touch(source);
    return getSnapshot();
  }

  function createSession(input = {}, source = "tikpal") {
    const id = `ctrl_${Math.random().toString(36).slice(2, 10)}`;
    const session = {
      id,
      deviceId: input.deviceId ?? id,
      name: input.name ?? "Tikpal Portable Controller",
      capabilities: input.capabilities ?? ["show_controls", "hide_controls", "set_state", "toggle_play", "set_volume"],
      createdAt: now(),
      updatedAt: now(),
      lastSource: source,
    };

    sessions.set(id, session);
    return structuredClone(session);
  }

  function getSession(id) {
    const session = sessions.get(id);
    return session ? structuredClone(session) : null;
  }

  function deleteSession(id) {
    return sessions.delete(id);
  }

  return {
    getSnapshot,
    patchState,
    runAction,
    createSession,
    getSession,
    deleteSession,
  };
}
