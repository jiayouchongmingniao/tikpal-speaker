import { useEffect, useMemo, useRef, useState } from "react";
import { createSystemServiceClient } from "../bridge/systemServiceClient";

const MODE_ORDER = ["listen", "flow", "screen"];

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getAdjacentMode(currentMode, direction = 1) {
  const normalizedMode = currentMode === "overview" ? "listen" : currentMode;
  const currentIndex = MODE_ORDER.indexOf(normalizedMode);
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (baseIndex + direction + MODE_ORDER.length) % MODE_ORDER.length;
  return MODE_ORDER[nextIndex];
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

function applyLocalAction(currentState, type, payload = {}, source = "speaker-ui") {
  const liveState = currentState ?? createFallbackState();

  if (type === "set_mode" || type === "return_overview" || type === "next_mode" || type === "prev_mode") {
    const targetMode =
      type === "set_mode"
        ? payload.mode ?? "overview"
        : type === "return_overview"
          ? "overview"
          : getAdjacentMode(liveState.activeMode, type === "next_mode" ? 1 : -1);

    return {
      ...liveState,
      activeMode: targetMode,
      focusedPanel: targetMode === "overview" ? null : targetMode,
      transition: {
        status: "animating",
        from: liveState.activeMode,
        to: targetMode,
        startedAt: nowIso(),
        lockedUntil: Date.now() + 520,
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "show_controls") {
    return {
      ...liveState,
      overlay: {
        state: "controls",
        reason: payload.reason ?? "user",
        visible: true,
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "hide_controls") {
    return {
      ...liveState,
      overlay: {
        state: "hidden",
        reason: null,
        visible: false,
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "set_volume") {
    const volume = clamp(Number(payload.volume ?? liveState.playback?.volume ?? 58), 0, 100);
    return {
      ...liveState,
      playback: {
        ...liveState.playback,
        volume,
      },
      flow: {
        ...liveState.flow,
        audioMetrics: {
          ...(liveState.flow?.audioMetrics ?? {}),
          volumeNormalized: volume / 100,
        },
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "set_flow_state") {
    const nextFlowState = payload.state ?? liveState.flow?.state ?? "focus";
    return {
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
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  return {
    ...liveState,
    lastSource: source,
    lastUpdatedAt: nowIso(),
  };
}

function createFallbackState(initialMode = "overview", initialFlowState = "focus") {
  return {
    activeMode: initialMode,
    focusedPanel: initialMode === "overview" ? null : initialMode,
    transition: {
      status: "idle",
      from: initialMode,
      to: initialMode,
      startedAt: new Date().toISOString(),
      lockedUntil: 0,
    },
    overlay: {
      state: "hidden",
      visible: false,
    },
    playback: {
      state: "play",
      volume: 58,
      trackTitle: "Low Light Corridor",
      artist: "tikpal",
      source: "Mock Stream",
      progress: 0.63,
      format: "FLAC 24/96",
      nextTrackTitle: "Night Window",
    },
    flow: {
      state: initialFlowState,
      subtitle: "Deep Work",
    },
    screen: {
      currentTask: "Write Ambient OS Spec",
      nextTask: "Review notes",
      currentBlockTitle: "Deep Work Block",
      pomodoroState: "running",
      pomodoroRemainingSec: 1124,
      todaySummary: {
        remainingTasks: 3,
        remainingEvents: 2,
      },
    },
    system: {
      version: "0.1.0",
      performanceTier: "normal",
      otaStatus: "idle",
    },
    lastSource: "speaker-ui",
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function useSystemController({ initialMode = "overview", initialFlowState = "focus" } = {}) {
  const systemApi = useMemo(() => createSystemServiceClient(), []);
  const [state, setState] = useState(() => createFallbackState(initialMode, initialFlowState));
  const [capabilities, setCapabilities] = useState(null);
  const bootstrappedRef = useRef(false);
  const preferOverviewUntilActionRef = useRef(initialMode === "overview");

  useEffect(() => {
    let alive = true;

    async function sync() {
      try {
        const [nextState, nextCapabilities] = await Promise.all([
          systemApi.getState(),
          capabilities ? Promise.resolve(capabilities) : systemApi.getCapabilities(),
        ]);

        if (!alive) {
          return;
        }

        setState((current) => {
          if (preferOverviewUntilActionRef.current) {
            return {
              ...nextState,
              activeMode: "overview",
              focusedPanel: null,
            };
          }

          return nextState;
        });
        if (!capabilities) {
          setCapabilities(nextCapabilities);
        }
      } catch {
        // Keep the UI usable with the local fallback snapshot.
      }
    }

    sync();
    const intervalId = window.setInterval(sync, 1000);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [capabilities, systemApi]);

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;

    systemApi.sendAction("set_mode", { mode: initialMode }, "speaker-ui-bootstrap").catch(() => {});

    if (initialFlowState && initialMode === "flow") {
      systemApi.sendAction("set_flow_state", { state: initialFlowState }, "speaker-ui-bootstrap").catch(() => {});
    }
  }, [initialFlowState, initialMode, systemApi]);

  async function dispatch(type, payload = {}, source = "speaker-ui") {
    preferOverviewUntilActionRef.current = false;
    const optimisticState = applyLocalAction(state, type, payload, source);
    setState(optimisticState);

    try {
      const response = await systemApi.sendAction(type, payload, source);
      if (response?.state) {
        setState(response.state);
        return response.state;
      }

      setState(response);
      return response;
    } catch {
      return optimisticState;
    }
  }

  return {
    state,
    capabilities,
    dispatch,
    async setMode(mode) {
      return dispatch("set_mode", { mode });
    },
    async returnOverview() {
      return dispatch("return_overview");
    },
    async nextMode() {
      return dispatch("next_mode");
    },
    async prevMode() {
      return dispatch("prev_mode");
    },
    async showControls(reason = "user") {
      return dispatch("show_controls", { reason });
    },
    async hideControls() {
      return dispatch("hide_controls");
    },
    async togglePlay() {
      return dispatch("toggle_play");
    },
    async prevTrack() {
      return dispatch("prev_track");
    },
    async nextTrack() {
      return dispatch("next_track");
    },
    async setVolume(volume) {
      return dispatch("set_volume", { volume });
    },
    async setFlowState(nextState) {
      return dispatch("set_flow_state", { state: nextState });
    },
    async startPomodoro(durationSec = 1500) {
      return dispatch("screen_start_pomodoro", { durationSec });
    },
    async resumePomodoro() {
      return dispatch("screen_resume_pomodoro");
    },
    async pausePomodoro() {
      return dispatch("screen_pause_pomodoro");
    },
    async resetPomodoro() {
      return dispatch("screen_reset_pomodoro");
    },
    async completeCurrentTask() {
      return dispatch("screen_complete_current_task");
    },
  };
}
