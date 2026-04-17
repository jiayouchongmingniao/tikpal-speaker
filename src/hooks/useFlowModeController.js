import { useEffect, useMemo, useRef, useState } from "react";
import { createMockPlayerBridge } from "../bridge/playerBridge";
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
  const bridge = useMemo(() => createMockPlayerBridge(), []);
  const [currentState, setCurrentState] = useState(initialState);
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

  useEffect(() => bridge.subscribe(setPlayerState), [bridge]);

  useEffect(() => {
    const bootTimer = window.setTimeout(() => setAppPhase("idle_preview"), BOOT_MS);
    const immersiveTimer = window.setTimeout(() => {
      setAppPhase("immersive");
      setUiVisible(false);
    }, BOOT_MS + IDLE_PREVIEW_MS);

    return () => {
      window.clearTimeout(bootTimer);
      window.clearTimeout(immersiveTimer);
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

  function setState(nextState) {
    if (nextState === currentState || appPhase === "transitioning") {
      return;
    }

    setTransitionState({ from: currentState, to: nextState, startedAt: Date.now() });
    setAppPhase("transitioning");
    setUiVisible(false);
    bridge.nextStateMode(nextState);

    window.setTimeout(() => {
      setCurrentState(nextState);
      setTransitionState(null);
      setAppPhase(nextState === "sleep" ? "idle_preview" : "immersive");
    }, TRANSITION_MS);
  }

  function nextState(dir) {
    setState(nextStateInDirection(currentState, dir));
  }

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
