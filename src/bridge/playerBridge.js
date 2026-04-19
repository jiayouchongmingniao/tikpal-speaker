import { createFlowServiceClient } from "./flowServiceClient";

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

export function createPlayerBridge() {
  const mockBridge = createMockPlayerBridge();
  const flowApi = createFlowServiceClient();

  return {
    subscribe(listener) {
      return mockBridge.subscribe(listener);
    },
    async setVolume(volume) {
      await mockBridge.setVolume(volume);
      try {
        await flowApi.sendAction("set_volume", { volume }, "speaker-ui");
      } catch {
        // Ignore API availability failures and keep local control responsive.
      }
    },
    async togglePlay() {
      await mockBridge.togglePlay();
      try {
        await flowApi.sendAction("toggle_play", {}, "speaker-ui");
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
