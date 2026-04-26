import { createFlowServiceClient } from "./flowServiceClient.js";

const DEFAULT_PLAYER_STATE = {
  playbackState: "play",
  volume: 58,
  trackTitle: "Low Light Corridor",
  artist: "tikpal",
  source: "Mock Stream",
  progress: 0.32,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizePlaybackState(value, fallback = "pause") {
  if (["play", "pause", "stop"].includes(value)) {
    return value;
  }

  if (value === true || value === "playing") {
    return "play";
  }

  if (value === false || value === "paused") {
    return "pause";
  }

  return fallback;
}

function normalizePlayerPayload(payload = {}, fallback = DEFAULT_PLAYER_STATE) {
  const state = payload.playerState ?? payload.playback ?? payload;
  const volume = Number(state.volume ?? state.volumePercent ?? fallback.volume);
  const progress = Number(state.progress ?? state.elapsedRatio ?? fallback.progress);

  return {
    playbackState: normalizePlaybackState(state.playbackState ?? state.state ?? state.status, fallback.playbackState),
    volume: clamp(Number.isFinite(volume) ? volume : fallback.volume, 0, 100),
    trackTitle: state.trackTitle ?? state.title ?? state.song ?? fallback.trackTitle,
    artist: state.artist ?? state.albumArtist ?? fallback.artist,
    source: state.source ?? state.service ?? state.player ?? fallback.source,
    progress: clamp(Number.isFinite(progress) ? progress : fallback.progress, 0, 1),
  };
}

async function requestJson(url, { fetchImpl = fetch, method = "GET", body } = {}) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Player bridge request failed with ${response.status}`);
  }

  return response.json();
}

function getPlayerApiBase() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  return (
    params.get("playerApiBase") ||
    window.__TIKPAL_PLAYER_API_BASE__ ||
    ""
  ).replace(/\/+$/, "");
}

export function createMockPlayerBridge() {
  let state = { ...DEFAULT_PLAYER_STATE };
  let timer = null;

  const listeners = new Set();

  function emit() {
    for (const listener of listeners) {
      listener({ ...state });
    }
  }

  function startProgressTimer() {
    if (timer) {
      return;
    }

    timer = setInterval(() => {
      state = {
        ...state,
        progress: state.playbackState === "play" ? (state.progress + 0.0025) % 1 : state.progress,
      };
      emit();
    }, 1000);
  }

  function stopProgressTimer() {
    if (!timer || listeners.size > 0) {
      return;
    }

    clearInterval(timer);
    timer = null;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...state });
      startProgressTimer();
      return () => {
        listeners.delete(listener);
        stopProgressTimer();
      };
    },
    async setVolume(volume) {
      state = { ...state, volume: Math.max(0, Math.min(100, volume)) };
      emit();
    },
    async togglePlay() {
      state = {
        ...state,
        playbackState: state.playbackState === "play" ? "pause" : "play",
      };
      emit();
    },
    async nextTrack() {
      state = {
        ...state,
        trackTitle: state.trackTitle === "Low Light Corridor" ? "Night Window" : "Low Light Corridor",
        progress: 0,
      };
      emit();
    },
    async prevTrack() {
      state = {
        ...state,
        trackTitle: state.trackTitle === "Low Light Corridor" ? "Signal Bloom" : "Low Light Corridor",
        progress: 0,
      };
      emit();
    },
    async nextStateMode() {
      return Promise.resolve();
    },
  };
}

export function createHttpPlayerBridge({
  baseUrl,
  fetchImpl = fetch,
  pollIntervalMs = 1500,
  fallbackState = DEFAULT_PLAYER_STATE,
} = {}) {
  const normalizedBaseUrl = String(baseUrl ?? "").replace(/\/+$/, "");
  if (!normalizedBaseUrl) {
    throw new Error("playerApiBase is required");
  }

  let state = { ...fallbackState };
  let timer = null;
  let subscriberCount = 0;
  const listeners = new Set();

  function emit() {
    for (const listener of listeners) {
      listener({ ...state });
    }
  }

  async function refresh() {
    const payload = await requestJson(`${normalizedBaseUrl}/status`, { fetchImpl });
    state = normalizePlayerPayload(payload, state);
    emit();
  }

  async function sendCommand(action, payload = {}) {
    const response = await requestJson(`${normalizedBaseUrl}/actions`, {
      fetchImpl,
      method: "POST",
      body: {
        action,
        ...payload,
      },
    });
    state = normalizePlayerPayload(response, state);
    emit();
  }

  function startPolling() {
    if (timer || pollIntervalMs <= 0) {
      return;
    }

    timer = setInterval(() => {
      refresh().catch(() => {});
    }, pollIntervalMs);
  }

  function stopPolling() {
    if (!timer || subscriberCount > 0) {
      return;
    }

    clearInterval(timer);
    timer = null;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      subscriberCount += 1;
      listener({ ...state });
      refresh().catch(() => {});
      startPolling();
      return () => {
        listeners.delete(listener);
        subscriberCount = Math.max(0, subscriberCount - 1);
        stopPolling();
      };
    },
    async setVolume(volume) {
      await sendCommand("set_volume", { volume: clamp(Number(volume), 0, 100) });
    },
    async togglePlay() {
      await sendCommand("toggle_play");
    },
    async nextTrack() {
      await sendCommand("next_track");
    },
    async prevTrack() {
      await sendCommand("prev_track");
    },
  };
}

export function createPlayerBridge({ playerApiBase = getPlayerApiBase(), flowApi = createFlowServiceClient() } = {}) {
  let realBridge = null;

  if (playerApiBase) {
    try {
      realBridge = createHttpPlayerBridge({ baseUrl: playerApiBase });
    } catch {
      realBridge = null;
    }
  }

  const activeBridge = realBridge ?? createMockPlayerBridge();

  return {
    subscribe(listener) {
      return activeBridge.subscribe(listener);
    },
    async setVolume(volume) {
      await activeBridge.setVolume(volume);
      try {
        await flowApi.sendAction("set_volume", { volume }, "speaker-ui");
      } catch {
        // Ignore API availability failures and keep local control responsive.
      }
    },
    async togglePlay() {
      await activeBridge.togglePlay();
      try {
        await flowApi.sendAction("toggle_play", {}, "speaker-ui");
      } catch {
        // Ignore API availability failures and keep local control responsive.
      }
    },
    async nextTrack() {
      await activeBridge.nextTrack?.();
      try {
        await flowApi.sendAction("next_track", {}, "speaker-ui");
      } catch {
        // Ignore API availability failures and keep local control responsive.
      }
    },
    async prevTrack() {
      await activeBridge.prevTrack?.();
      try {
        await flowApi.sendAction("prev_track", {}, "speaker-ui");
      } catch {
        // Ignore API availability failures and keep local control responsive.
      }
    },
    async nextStateMode(state) {
      try {
        await flowApi.sendAction("set_state", { state }, "speaker-ui");
      } catch {
        // The local UI still transitions without a backing API.
      }
    },
  };
}
