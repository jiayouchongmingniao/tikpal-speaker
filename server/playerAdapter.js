const DEFAULT_TIMEOUT_MS = 5000;

function createPlayerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeBaseUrl(value) {
  return String(value ?? "").replace(/\/+$/, "");
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

function assertPlayerPayload(payload, context = "status") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createPlayerError("PLAYER_INVALID_PAYLOAD", `Player ${context} payload must be a JSON object`);
  }

  return payload;
}

export function normalizePlayerState(payload = {}, fallback = {}) {
  const state = payload.playerState ?? payload.playback ?? payload;
  const volume = Number(state.volume ?? state.volumePercent ?? fallback.volume ?? 58);
  const progress = Number(state.progress ?? state.elapsedRatio ?? fallback.progress ?? 0);

  return {
    state: normalizePlaybackState(state.playbackState ?? state.state ?? state.status, fallback.state ?? "pause"),
    volume: clamp(Number.isFinite(volume) ? volume : fallback.volume ?? 58, 0, 100),
    trackTitle: state.trackTitle ?? state.title ?? state.song ?? fallback.trackTitle ?? null,
    artist: state.artist ?? state.albumArtist ?? fallback.artist ?? null,
    source: state.source ?? state.service ?? state.player ?? state.origin ?? fallback.source ?? null,
    progress: clamp(Number.isFinite(progress) ? progress : fallback.progress ?? 0, 0, 1),
    nextTrackTitle: state.nextTrackTitle ?? state.nextTitle ?? state.nextSong ?? fallback.nextTrackTitle ?? null,
  };
}

async function requestJson(url, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, method = "GET", body } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs ?? DEFAULT_TIMEOUT_MS)));

  try {
    const response = await fetchImpl(url, {
      method,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw createPlayerError("PLAYER_HTTP_ERROR", `Player request failed with ${response.status}`);
    }

    try {
      return await response.json();
    } catch {
      throw createPlayerError("PLAYER_INVALID_PAYLOAD", "Player response is not valid JSON");
    }
  } catch (error) {
    if (error?.name === "AbortError" || error?.code === "ABORT_ERR") {
      throw createPlayerError("PLAYER_TIMEOUT", `Player request timed out after ${timeoutMs}ms`);
    }

    if (error?.code) {
      throw error;
    }

    throw createPlayerError("PLAYER_NETWORK_ERROR", error instanceof Error ? error.message : "Player request failed");
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createHttpPlayerAdapter({ baseUrl = process.env.TIKPAL_PLAYER_API_BASE, timeoutMs = process.env.TIKPAL_PLAYER_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw createPlayerError("PLAYER_BASE_URL_MISSING", "Player API base URL is required");
  }

  const normalizedTimeoutMs = Number(timeoutMs ?? DEFAULT_TIMEOUT_MS);

  return {
    mode: "http",
    baseUrl: normalizedBaseUrl,
    async getStatus(fallback = {}) {
      const payload = await requestJson(`${normalizedBaseUrl}/status`, {
        fetchImpl,
        timeoutMs: normalizedTimeoutMs,
      });
      return normalizePlayerState(assertPlayerPayload(payload, "status"), fallback);
    },
    async runAction(type, payload = {}, fallback = {}) {
      const actionPayload =
        type === "set_volume"
          ? {
              action: type,
              volume: clamp(Number(payload.volume ?? fallback.volume ?? 58), 0, 100),
            }
          : {
              action: type,
            };
      const response = await requestJson(`${normalizedBaseUrl}/actions`, {
        fetchImpl,
        timeoutMs: normalizedTimeoutMs,
        method: "POST",
        body: actionPayload,
      });
      return normalizePlayerState(assertPlayerPayload(response, "action"), fallback);
    },
  };
}
