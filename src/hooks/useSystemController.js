import { useEffect, useMemo, useRef, useState } from "react";
import { createSystemServiceClient } from "../bridge/systemServiceClient";

function createFallbackState(initialMode = "overview", initialFlowState = "focus") {
  return {
    activeMode: initialMode,
    focusedPanel: initialMode === "overview" ? null : initialMode,
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

        setState(nextState);
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
    const response = await systemApi.sendAction(type, payload, source);
    if (response?.state) {
      setState(response.state);
      return response.state;
    }

    setState(response);
    return response;
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
    async showControls(reason = "user") {
      return dispatch("show_controls", { reason });
    },
    async hideControls() {
      return dispatch("hide_controls");
    },
    async togglePlay() {
      return dispatch("toggle_play");
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
    async pausePomodoro() {
      return dispatch("screen_pause_pomodoro");
    },
    async completeCurrentTask() {
      return dispatch("screen_complete_current_task");
    },
  };
}
