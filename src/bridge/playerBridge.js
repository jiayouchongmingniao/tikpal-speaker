/**
 * Replace this with the moOde-backed implementation once the API contract is fixed.
 * The page already consumes only this bridge shape.
 */
export function createMockPlayerBridge() {
  let state = {
    playbackState: "play",
    volume: 58,
    trackTitle: "Low Light Corridor",
    artist: "tikpal",
    source: "Mock Stream",
    progress: 0.32,
  };

  const listeners = new Set();

  function emit() {
    for (const listener of listeners) {
      listener({ ...state });
    }
  }

  setInterval(() => {
    state = {
      ...state,
      progress: state.playbackState === "play" ? (state.progress + 0.0025) % 1 : state.progress,
    };
    emit();
  }, 1000);

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...state });
      return () => listeners.delete(listener);
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
    async nextStateMode() {
      return Promise.resolve();
    },
  };
}
