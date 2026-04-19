import { useEffect, useMemo, useRef, useState } from "react";
import { createPlayerBridge } from "../bridge/playerBridge";
import { createFlowServiceClient } from "../bridge/flowServiceClient";
import { FLOW_ORDER } from "../theme";

const CONTROL_TIMEOUT_MS = 3000;
const BOOT_MS = 2800;
const IDLE_PREVIEW_MS = 14000;
const TRANSITION_MS = 1400;
const SMOOTHING = 0.15;

function nextStateInDirection(currentState, dir) {
  const currentIndex = FLOW_ORDER.indexOf(currentState);
  const step = dir === "right" ? 1 : -1;
  const nextIndex = (currentIndex + step + FLOW_ORDER.length) % FLOW_ORDER.length;
  return FLOW_ORDER[nextIndex];
}

function createSeedMetrics() {
  return {
    volumeNormalized: 0.58,
    lowEnergy: 0.28,
    midEnergy: 0.22,
    highEnergy: 0.18,
    beatConfidence: 0.12,
    isPlaying: true,
  };
}

export function useFlowModeController(initialState = "focus") {
  const bridge = useMemo(() => createPlayerBridge(), []);
  const flowApi = useMemo(() => createFlowServiceClient(), []);
  const [currentState, setCurrentState] = useState(
    FLOW_ORDER.includes(initialState) ? initialState : "focus",
  );
  const [appPhase, setAppPhase] = useState("booting");
  const [uiVisible, setUiVisible] = useState(true);
  const [playerState, setPlayerState] = useState({
    playbackState: "play",
    volume: 58,
    trackTitle: "Low Light Corridor",
    artist: "tikpal",
    source: "Mock Stream",
    progress: 0.32,
  });
  const [audioMetrics, setAudioMetrics] = useState(createSeedMetrics);
  const [transitionState, setTransitionState] = useState(null);
  const hideTimerRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const previewTimerRef = useRef(null);
  const sourceIdRef = useRef(`speaker-ui-${Math.random().toString(36).slice(2, 10)}`);
  const currentStateRef = useRef(currentState);
  const appPhaseRef = useRef(appPhase);
  const uiVisibleRef = useRef(uiVisible);
  const applyStateTransitionRef = useRef(null);

  useEffect(() => {
    currentStateRef.current = currentState;
    appPhaseRef.current = appPhase;
    uiVisibleRef.current = uiVisible;
  }, [appPhase, currentState, uiVisible]);

  useEffect(() => bridge.subscribe(setPlayerState), [bridge]);

  useEffect(() => {
    const bootTimer = window.setTimeout(() => setAppPhase("idle_preview"), BOOT_MS);
    previewTimerRef.current = window.setTimeout(() => {
      setAppPhase("immersive");
      setUiVisible(false);
    }, BOOT_MS + IDLE_PREVIEW_MS);

    return () => {
      window.clearTimeout(bootTimer);
      window.clearTimeout(previewTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setAudioMetrics((current) => {
        const time = Date.now() / 1000;
        const incoming = {
          volumeNormalized: playerState.volume / 100,
          lowEnergy: playerState.playbackState === "play" ? 0.35 + Math.sin(time * 0.7) * 0.2 : 0.05,
          midEnergy: playerState.playbackState === "play" ? 0.26 + Math.sin(time * 0.45 + 0.8) * 0.16 : 0.04,
          highEnergy: playerState.playbackState === "play" ? 0.18 + Math.sin(time * 1.1 + 1.7) * 0.14 : 0.03,
          beatConfidence: playerState.playbackState === "play" ? 0.2 + Math.sin(time * 0.9) * 0.15 : 0.02,
          isPlaying: playerState.playbackState === "play",
        };

        return {
          volumeNormalized: current.volumeNormalized * (1 - SMOOTHING) + incoming.volumeNormalized * SMOOTHING,
          lowEnergy: current.lowEnergy * (1 - SMOOTHING) + incoming.lowEnergy * SMOOTHING,
          midEnergy: current.midEnergy * (1 - SMOOTHING) + incoming.midEnergy * SMOOTHING,
          highEnergy: current.highEnergy * (1 - SMOOTHING) + incoming.highEnergy * SMOOTHING,
          beatConfidence: current.beatConfidence * (1 - SMOOTHING) + incoming.beatConfidence * SMOOTHING,
          isPlaying: incoming.isPlaying,
        };
      });
    }, 120);

    return () => window.clearInterval(interval);
  }, [playerState.playbackState, playerState.volume]);

  useEffect(() => {
    if (currentState !== "sleep" || appPhase === "transitioning" || uiVisible) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setAppPhase("sleep_dimmed");
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [appPhase, currentState, uiVisible]);

  useEffect(
    () => () => {
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(transitionTimerRef.current);
      window.clearTimeout(previewTimerRef.current);
    },
    [],
  );

  function resetHideTimer() {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = window.setTimeout(() => {
      setUiVisible(false);
      setAppPhase((phase) => (phase === "transitioning" ? phase : "immersive"));
    }, CONTROL_TIMEOUT_MS);
  }

  function showControls() {
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
    }
    setUiVisible(true);
    setAppPhase((phase) => (phase === "booting" ? phase : "controls_visible"));
    resetHideTimer();
  }

  function hideControls() {
    setUiVisible(false);
    setAppPhase((phase) => (phase === "booting" ? phase : "immersive"));
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
  }

  function applyStateTransition(nextState, options = {}) {
    const { broadcast = true } = options;

    if (nextState === currentStateRef.current || appPhaseRef.current === "transitioning") {
      return;
    }

    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
    }

    setTransitionState({ from: currentStateRef.current, to: nextState, startedAt: Date.now() });
    setAppPhase("transitioning");
    setUiVisible(false);
    if (broadcast) {
      bridge.nextStateMode(nextState);
    }

    transitionTimerRef.current = window.setTimeout(() => {
      setCurrentState(nextState);
      setTransitionState(null);
      setAppPhase(nextState === "sleep" ? "idle_preview" : "immersive");
    }, TRANSITION_MS);
  }

  applyStateTransitionRef.current = applyStateTransition;

  function setState(nextState) {
    applyStateTransition(nextState, { broadcast: true });
  }

  function nextState(dir) {
    setState(nextStateInDirection(currentState, dir));
  }

  useEffect(() => {
    let cancelled = false;

    async function pullRemoteState() {
      try {
        const snapshot = await flowApi.getState();
        if (cancelled || snapshot.lastSource === sourceIdRef.current) {
          return;
        }

        if (
          snapshot.currentState &&
          snapshot.currentState !== currentStateRef.current &&
          appPhaseRef.current !== "transitioning"
        ) {
          applyStateTransitionRef.current?.(snapshot.currentState, { broadcast: false });
          return;
        }

        if (snapshot.playerState) {
          setPlayerState((current) => ({ ...current, ...snapshot.playerState }));
        }

        if (typeof snapshot.uiVisible === "boolean" && snapshot.uiVisible !== uiVisibleRef.current) {
          if (snapshot.uiVisible) {
            showControls();
          } else {
            hideControls();
          }
        }
      } catch {
        // The UI continues to run against the local mock bridge when the API is unavailable.
      }
    }

    pullRemoteState();
    const interval = window.setInterval(pullRemoteState, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [flowApi]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      flowApi.patchState({
        currentState,
        uiVisible,
        appPhase,
        playerState,
        source: sourceIdRef.current,
      }).catch(() => {
        // Ignore API availability failures in local-only mode.
      });
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [appPhase, currentState, flowApi, playerState, uiVisible]);

  return {
    currentState,
    uiVisible,
    appPhase,
    audioMetrics,
    playerState,
    transitionState,
    showControls,
    hideControls,
    nextState,
    setState,
    setVolume: bridge.setVolume,
    togglePlay: bridge.togglePlay,
  };
}
