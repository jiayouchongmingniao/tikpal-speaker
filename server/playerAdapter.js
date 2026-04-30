import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MPD_HOST = "127.0.0.1";
const DEFAULT_MPD_PORT = 6600;
const execFile = promisify(execFileCallback);

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

function getFirstPresent(source, keys, fallback = null) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
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
  const durationSec = Number(state.durationSec ?? state.durationSeconds ?? fallback.durationSec ?? 0);
  const currentTrackIndex = Number(state.currentTrackIndex ?? state.songIndex ?? fallback.currentTrackIndex ?? 0);
  const queueLength = Number(state.queueLength ?? state.playlistLength ?? fallback.queueLength ?? 0);
  const sampleRate = Number(state.sampleRate ?? state.sampleRateHz ?? fallback.sampleRate ?? 0);
  const bitDepth = Number(state.bitDepth ?? state.bits ?? fallback.bitDepth ?? 0);

  return {
    state: normalizePlaybackState(state.playbackState ?? state.state ?? state.status, fallback.state ?? "pause"),
    volume: clamp(Number.isFinite(volume) ? volume : fallback.volume ?? 58, 0, 100),
    trackTitle: getFirstPresent(state, ["trackTitle", "title", "song"], fallback.trackTitle ?? null),
    artist: getFirstPresent(state, ["artist", "albumArtist"], fallback.artist ?? null),
    album: getFirstPresent(state, ["album"], fallback.album ?? null),
    source: getFirstPresent(state, ["source", "service", "player", "origin"], fallback.source ?? null),
    progress: clamp(Number.isFinite(progress) ? progress : fallback.progress ?? 0, 0, 1),
    durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : fallback.durationSec ?? null,
    format: getFirstPresent(state, ["format"], fallback.format ?? null),
    sampleRate: Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : fallback.sampleRate ?? null,
    bitDepth: Number.isFinite(bitDepth) && bitDepth > 0 ? bitDepth : fallback.bitDepth ?? null,
    nextTrackTitle: getFirstPresent(state, ["nextTrackTitle", "nextTitle", "nextSong"], fallback.nextTrackTitle ?? null),
    currentTrackIndex: Number.isFinite(currentTrackIndex) && currentTrackIndex >= 0 ? currentTrackIndex : fallback.currentTrackIndex ?? 0,
    queueLength: Number.isFinite(queueLength) && queueLength >= 0 ? queueLength : fallback.queueLength ?? 0,
  };
}

function normalizeCommandOutput(stdout = "") {
  return String(stdout ?? "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

function parseClockToSeconds(value = "") {
  const match = String(value ?? "").match(/^(\d+):(\d{2})$/);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function parseMpcStatusOutput(statusOutput = "", playlistOutput = "", fallback = {}) {
  const statusLines = normalizeCommandOutput(statusOutput);
  const playlistLines = normalizeCommandOutput(playlistOutput);
  const volumeLine = statusLines.find((line) => line.includes("volume:")) ?? "";
  const stateLine = statusLines.find((line) => /\[[^\]]+\]/.test(line)) ?? "";
  const metadataLine = statusLines.find((line) => line.includes("\t")) ?? "";
  const [trackTitle = null, artist = null, album = null] = metadataLine.split("\t");
  const stateMatch = stateLine.match(/\[(playing|paused|stopped|stop)\]/i);
  const queueMatch = stateLine.match(/#(\d+)\/(\d+)/);
  const progressMatch = stateLine.match(/(\d+:\d+)\/(\d+:\d+)\s+\((\d+)%\)/);
  const volumeMatch = volumeLine.match(/volume:\s*(\d+)%/i);
  const currentTrackIndex = queueMatch ? Math.max(0, Number(queueMatch[1]) - 1) : fallback.currentTrackIndex ?? 0;
  const queueLength = queueMatch ? Number(queueMatch[2]) : playlistLines.length;
  const durationSec = progressMatch ? parseClockToSeconds(progressMatch[2]) : fallback.durationSec ?? null;
  const elapsedSec = progressMatch ? parseClockToSeconds(progressMatch[1]) : null;
  const progress =
    elapsedSec !== null && durationSec ? clamp(elapsedSec / durationSec, 0, 1) : fallback.progress ?? 0;
  const nextTrackTitle = queueLength > currentTrackIndex + 1 ? playlistLines[currentTrackIndex + 1] ?? null : null;

  return normalizePlayerState(
    {
      state:
        stateMatch?.[1]?.toLowerCase() === "playing"
          ? "play"
          : stateMatch?.[1]?.toLowerCase() === "paused"
            ? "pause"
            : stateMatch?.[1]?.toLowerCase() === "stopped"
              ? "stop"
              : fallback.state ?? "pause",
      volume: volumeMatch ? Number(volumeMatch[1]) : fallback.volume ?? 58,
      trackTitle: trackTitle || null,
      artist: artist || null,
      album: album || null,
      source: "moOde",
      progress,
      durationSec,
      nextTrackTitle,
      currentTrackIndex,
      queueLength,
    },
    fallback,
  );
}

async function execMpcCommand(
  args,
  {
    host = DEFAULT_MPD_HOST,
    port = DEFAULT_MPD_PORT,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    execFileImpl = execFile,
  } = {},
) {
  try {
    const { stdout } = await execFileImpl(
      "mpc",
      ["--host", String(host), "--port", String(port), ...args],
      {
        timeout: Math.max(1, Number(timeoutMs ?? DEFAULT_TIMEOUT_MS)),
        maxBuffer: 1024 * 1024,
      },
    );
    return String(stdout ?? "");
  } catch (error) {
    if (error?.killed || error?.signal === "SIGTERM") {
      throw createPlayerError("PLAYER_TIMEOUT", `mpc request timed out after ${timeoutMs}ms`);
    }

    throw createPlayerError("PLAYER_NETWORK_ERROR", error instanceof Error ? error.message : "mpc request failed");
  }
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

export function createMpcPlayerAdapter({
  host = process.env.TIKPAL_MPD_HOST ?? DEFAULT_MPD_HOST,
  port = process.env.TIKPAL_MPD_PORT ?? DEFAULT_MPD_PORT,
  timeoutMs = process.env.TIKPAL_PLAYER_TIMEOUT_MS,
  execFileImpl = execFile,
} = {}) {
  const normalizedPort = Number(port ?? DEFAULT_MPD_PORT);
  const normalizedTimeoutMs = Number(timeoutMs ?? DEFAULT_TIMEOUT_MS);

  async function getStatus(fallback = {}) {
    const [statusOutput, playlistOutput] = await Promise.all([
      execMpcCommand(["--format", "%title%\t%artist%\t%album%", "status"], {
        host,
        port: normalizedPort,
        timeoutMs: normalizedTimeoutMs,
        execFileImpl,
      }),
      execMpcCommand(["--format", "%title%", "playlist"], {
        host,
        port: normalizedPort,
        timeoutMs: normalizedTimeoutMs,
        execFileImpl,
      }),
    ]);

    return parseMpcStatusOutput(statusOutput, playlistOutput, fallback);
  }

  return {
    mode: "mpc",
    host,
    port: normalizedPort,
    async getStatus(fallback = {}) {
      return getStatus(fallback);
    },
    async runAction(type, payload = {}, fallback = {}) {
      if (type === "toggle_play") {
        await execMpcCommand(["toggle"], { host, port: normalizedPort, timeoutMs: normalizedTimeoutMs, execFileImpl });
      } else if (type === "next_track") {
        await execMpcCommand(["next"], { host, port: normalizedPort, timeoutMs: normalizedTimeoutMs, execFileImpl });
      } else if (type === "prev_track") {
        await execMpcCommand(["prev"], { host, port: normalizedPort, timeoutMs: normalizedTimeoutMs, execFileImpl });
      } else if (type === "set_volume") {
        await execMpcCommand(["volume", String(clamp(Number(payload.volume ?? fallback.volume ?? 58), 0, 100))], {
          host,
          port: normalizedPort,
          timeoutMs: normalizedTimeoutMs,
          execFileImpl,
        });
      } else if (type === "play_media") {
        const mediaPath = String(payload.mediaPath ?? "")
          .trim()
          .replace(/^\/+/, "");
        if (!mediaPath) {
          throw createPlayerError("PLAYER_MEDIA_PATH_MISSING", "mediaPath is required for play_media");
        }

        await execMpcCommand(["clear"], {
          host,
          port: normalizedPort,
          timeoutMs: normalizedTimeoutMs,
          execFileImpl,
        });
        await execMpcCommand(["add", mediaPath], {
          host,
          port: normalizedPort,
          timeoutMs: normalizedTimeoutMs,
          execFileImpl,
        });
        await execMpcCommand(["play"], {
          host,
          port: normalizedPort,
          timeoutMs: normalizedTimeoutMs,
          execFileImpl,
        });
      } else {
        throw createPlayerError("PLAYER_UNSUPPORTED_ACTION", `Unsupported player action: ${type}`);
      }

      return getStatus(fallback);
    },
  };
}
