import { useEffect, useMemo, useRef, useState } from "react";
import { createSystemServiceClient } from "../bridge/systemServiceClient";

const MODE_ORDER = ["listen", "flow", "screen"];
const CREATIVE_CARE_MOODS = ["clear", "scattered", "stuck", "tired", "calm", "energized"];
const CREATIVE_CARE_MODES = ["focus", "flow", "unwind", "sleep"];
const MODE_TRANSITION_MS = 280;
const FLOW_TRANSITION_MS = 220;

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
      source: "speaker-ui",
      captureLength: 0,
    },
  };
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

function deriveScreenContext(nextState) {
  const screen = nextState?.screen ?? {};
  return {
    now: new Date().toISOString(),
    focusItem:
      screen.pomodoroFocusTask || screen.currentTask
        ? {
            id: screen.pomodoroFocusTask ? "manual_pomodoro_focus" : "manual_focus",
            title: screen.pomodoroFocusTask ?? screen.currentTask,
            source: "manual",
          }
        : null,
    currentBlock: screen.currentBlockTitle
      ? {
          id: "manual_current_block",
          title: screen.currentBlockTitle,
          source: "manual",
        }
      : null,
    nextBlock: screen.nextTask
      ? {
          id: "manual_next_item",
          title: screen.nextTask,
          source: "manual",
          kind: "task",
        }
      : null,
    pomodoro: {
      state: screen.pomodoroState ?? "idle",
      remainingSec: Number(screen.pomodoroRemainingSec ?? screen.pomodoroDurationSec ?? 1500),
      durationSec: Number(screen.pomodoroDurationSec ?? 1500),
      boundTaskId: screen.pomodoroFocusTask ? "manual_pomodoro_focus" : screen.currentTask ? "manual_focus" : null,
    },
    todaySummary: {
      remainingTasks: Number(screen.todaySummary?.remainingTasks ?? 0),
      remainingEvents: Number(screen.todaySummary?.remainingEvents ?? 0),
    },
    sync: {
      stale: Boolean(screen.sync?.stale),
      lastCalendarSyncAt: null,
      lastTodoistSyncAt: null,
      calendarStatus: "idle",
      todoistStatus: "idle",
    },
  };
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
      focusedPanel:
        targetMode === "overview"
          ? liveState.activeMode === "overview"
            ? liveState.focusedPanel
            : liveState.activeMode
          : targetMode,
      transition: {
        status: "animating",
        from: liveState.activeMode,
        to: targetMode,
        startedAt: nowIso(),
        lockedUntil: Date.now() + MODE_TRANSITION_MS,
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "focus_panel") {
    const panel = MODE_ORDER.includes(payload.panel) ? payload.panel : liveState.focusedPanel ?? "listen";
    return {
      ...liveState,
      activeMode: "overview",
      focusedPanel: panel,
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
        lockedUntil: Date.now() + FLOW_TRANSITION_MS,
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

  if (type === "voice_capture_submit") {
    const previousCare = liveState.creativeCare ?? getDefaultCreativeCare();
    const transcript = String(payload.transcript ?? "").replace(/\s+/g, " ").trim();
    const moodLabel = CREATIVE_CARE_MOODS.includes(payload.moodLabel) ? payload.moodLabel : previousCare.moodLabel ?? "clear";
    const currentCareMode = CREATIVE_CARE_MODES.includes(payload.careMode) ? payload.careMode : deriveCareModeFromMood(moodLabel);
    const suggestedFlowState = deriveFlowStateFromCareMode(currentCareMode);
    const insightSentence = createInsightSentence(transcript, previousCare.insightSentence);
    return {
      ...liveState,
      creativeCare: {
        ...previousCare,
        latestTranscript: transcript,
        moodLabel,
        moodIntensity: clamp(Number(payload.moodIntensity ?? previousCare.moodIntensity ?? 0.45), 0, 1),
        inspirationSummary: payload.inspirationSummary ?? (transcript ? `Noted: ${insightSentence}` : previousCare.inspirationSummary),
        suggestedFlowState,
        currentCareMode,
        insightSentence,
        updatedAt: nowIso(),
        metadata: {
          source,
          captureLength: transcript.length,
        },
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "voice_mood_set") {
    const previousCare = liveState.creativeCare ?? getDefaultCreativeCare();
    const moodLabel = CREATIVE_CARE_MOODS.includes(payload.moodLabel) ? payload.moodLabel : previousCare.moodLabel ?? "clear";
    const currentCareMode = deriveCareModeFromMood(moodLabel);
    return {
      ...liveState,
      creativeCare: {
        ...previousCare,
        moodLabel,
        moodIntensity: clamp(Number(payload.moodIntensity ?? previousCare.moodIntensity ?? 0.45), 0, 1),
        currentCareMode,
        suggestedFlowState: deriveFlowStateFromCareMode(currentCareMode),
        updatedAt: nowIso(),
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "voice_care_mode_set") {
    const previousCare = liveState.creativeCare ?? getDefaultCreativeCare();
    const currentCareMode = CREATIVE_CARE_MODES.includes(payload.careMode) ? payload.careMode : previousCare.currentCareMode ?? "flow";
    return {
      ...liveState,
      creativeCare: {
        ...previousCare,
        currentCareMode,
        suggestedFlowState: deriveFlowStateFromCareMode(currentCareMode),
        updatedAt: nowIso(),
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "voice_reflection_clear") {
    const previousCare = liveState.creativeCare ?? getDefaultCreativeCare();
    return {
      ...liveState,
      creativeCare: {
        ...getDefaultCreativeCare(),
        moodLabel: previousCare.moodLabel,
        moodIntensity: previousCare.moodIntensity,
        currentCareMode: previousCare.currentCareMode,
        suggestedFlowState: previousCare.suggestedFlowState,
        updatedAt: nowIso(),
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "screen_start_pomodoro") {
    const durationSec = clamp(Number(payload.durationSec ?? liveState.screen?.pomodoroDurationSec ?? 1500), 60, 7200);
    return {
      ...liveState,
      activeMode: "screen",
      focusedPanel: "screen",
      screen: {
        ...liveState.screen,
        pomodoroState: "running",
        pomodoroFocusTask: liveState.screen?.currentTask,
        pomodoroDurationSec: durationSec,
        pomodoroRemainingSec: durationSec,
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "screen_resume_pomodoro") {
    return {
      ...liveState,
      screen: {
        ...liveState.screen,
        pomodoroState: "running",
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "screen_pause_pomodoro") {
    return {
      ...liveState,
      screen: {
        ...liveState.screen,
        pomodoroState: "paused",
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "screen_reset_pomodoro") {
    return {
      ...liveState,
      screen: {
        ...liveState.screen,
        pomodoroState: "idle",
        pomodoroFocusTask: liveState.screen?.currentTask,
        pomodoroRemainingSec: liveState.screen?.pomodoroDurationSec ?? 1500,
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "screen_complete_current_task") {
    return {
      ...liveState,
      screen: {
        ...liveState.screen,
        currentTask: liveState.screen?.nextTask ?? "Plan next session",
        nextTask: "Plan next session",
        pomodoroFocusTask: liveState.screen?.nextTask ?? "Plan next session",
        pomodoroState: "idle",
        pomodoroRemainingSec: liveState.screen?.pomodoroDurationSec ?? 1500,
        completedPomodoros: Number(liveState.screen?.completedPomodoros ?? 0) + 1,
        todaySummary: {
          ...liveState.screen?.todaySummary,
          remainingTasks: Math.max(0, Number(liveState.screen?.todaySummary?.remainingTasks ?? 0) - 1),
        },
      },
      lastSource: source,
      lastUpdatedAt: nowIso(),
    };
  }

  if (type === "screen_set_focus_item") {
    const title = String(payload.title ?? "").trim() || liveState.screen?.currentTask || "No focus item";
    return {
      ...liveState,
      activeMode: "screen",
      focusedPanel: "screen",
      screen: {
        ...liveState.screen,
        currentTask: title,
        pomodoroFocusTask: title,
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
      subtitle: deriveFlowSubtitle(initialFlowState),
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
      todaySummary: {
        remainingTasks: 55,
        remainingEvents: 2,
      },
    },
    creativeCare: getDefaultCreativeCare(),
    system: {
      version: "0.1.0",
      performanceTier: "normal",
      renderProfile: "off",
      otaStatus: "idle",
      performance: {
        avgFps: 60,
        interactionLatencyMs: null,
        memoryUsageMb: null,
        lastDegradeReason: null,
        tierDecisionReason: "boot_default",
        tierCooldownUntil: null,
        tierCooldownRemainingMs: 0,
        performanceTierUpdatedAt: new Date().toISOString(),
      },
    },
    lastSource: "speaker-ui",
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function useSystemController({ initialMode = "overview", initialFlowState = "focus" } = {}) {
  const systemApi = useMemo(() => createSystemServiceClient(), []);
  const [state, setState] = useState(() => createFallbackState(initialMode, initialFlowState));
  const [screenContext, setScreenContext] = useState(() => deriveScreenContext(createFallbackState(initialMode, initialFlowState)));
  const [capabilities, setCapabilities] = useState(null);
  const bootstrappedRef = useRef(false);
  const preferOverviewUntilActionRef = useRef(initialMode === "overview");
  const pendingInitialModeRef = useRef(initialMode !== "overview" ? initialMode : null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let alive = true;

    async function sync() {
      try {
        const [nextState, nextCapabilities, nextScreenContext] = await Promise.all([
          systemApi.getState(),
          capabilities ? Promise.resolve(capabilities) : systemApi.getCapabilities(),
          systemApi.getScreenContext(),
        ]);

        if (!alive) {
          return;
        }

        setState((current) => {
          if (pendingInitialModeRef.current) {
            if (nextState.activeMode === pendingInitialModeRef.current) {
              pendingInitialModeRef.current = null;
              return nextState;
            }

            return {
              ...nextState,
              activeMode: pendingInitialModeRef.current,
              focusedPanel: pendingInitialModeRef.current,
              transition: {
                ...(nextState.transition ?? {}),
                status: "idle",
                from: pendingInitialModeRef.current,
                to: pendingInitialModeRef.current,
                lockedUntil: 0,
              },
            };
          }

          if (preferOverviewUntilActionRef.current) {
            return {
              ...nextState,
              activeMode: "overview",
              focusedPanel: null,
            };
          }

          return nextState;
        });
        setScreenContext(nextScreenContext);
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

    if (initialMode !== "overview") {
      systemApi
        .sendAction("set_mode", { mode: initialMode }, "speaker-ui-bootstrap")
        .then((response) => {
          pendingInitialModeRef.current = null;
          const nextState = response?.state ?? response;
          if (nextState?.activeMode) {
            setState(nextState);
            setScreenContext(deriveScreenContext(nextState));
          }
        })
        .catch(() => {});
    }

    if (initialFlowState && initialMode === "flow") {
      systemApi.sendAction("set_flow_state", { state: initialFlowState }, "speaker-ui-bootstrap").catch(() => {});
    }
  }, [initialFlowState, initialMode, systemApi]);

  useEffect(() => {
    const lockedUntil = Number(state.transition?.lockedUntil ?? 0);
    if (state.transition?.status !== "animating" || lockedUntil <= 0) {
      return undefined;
    }

    const remainingMs = lockedUntil - Date.now();
    if (remainingMs <= 0) {
      setState((current) => {
        if (current.transition?.status !== "animating") {
          return current;
        }

        return {
          ...current,
          transition: {
            ...current.transition,
            status: "idle",
            lockedUntil: 0,
          },
        };
      });
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setState((current) => {
        if (current.transition?.status !== "animating") {
          return current;
        }

        return {
          ...current,
          transition: {
            ...current.transition,
            status: "idle",
            lockedUntil: 0,
          },
        };
      });
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [state.transition]);

  async function dispatch(type, payload = {}, source = "speaker-ui") {
    pendingInitialModeRef.current = null;
    preferOverviewUntilActionRef.current = false;
    const optimisticState = applyLocalAction(stateRef.current, type, payload, source);
    setState(optimisticState);
    setScreenContext(deriveScreenContext(optimisticState));

    try {
      const response = await systemApi.sendAction(type, payload, source);
      if (response?.state) {
        setState(response.state);
        setScreenContext(deriveScreenContext(response.state));
        return response.state;
      }

      setState(response);
      setScreenContext(deriveScreenContext(response));
      return response;
    } catch {
      return optimisticState;
    }
  }

  return {
    state,
    screenContext,
    capabilities,
    dispatch,
    async setMode(mode) {
      return dispatch("set_mode", { mode });
    },
    async returnOverview() {
      return dispatch("return_overview");
    },
    async focusPanel(panel) {
      return dispatch("focus_panel", { panel });
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
    async setScreenFocusItem(title) {
      return dispatch("screen_set_focus_item", { title });
    },
    async submitVoiceCapture(payload) {
      return dispatch("voice_capture_submit", payload);
    },
    async setVoiceMood(moodLabel, moodIntensity) {
      return dispatch("voice_mood_set", { moodLabel, moodIntensity });
    },
    async setVoiceCareMode(careMode) {
      return dispatch("voice_care_mode_set", { careMode });
    },
    async clearVoiceReflection() {
      return dispatch("voice_reflection_clear");
    },
    async reportPerformance(payload) {
      try {
        const response = await systemApi.sendAction("runtime_report_performance", payload, "speaker-ui-performance");
        if (response?.state) {
          setState(response.state);
          return response.state;
        }
        return response;
      } catch {
        return null;
      }
    },
  };
}
