const PENDING_VISUAL_SYNC_TIMEOUT_MS = 8000;
const VISUAL_ACTION_TYPES = new Set([
  "set_mode",
  "return_overview",
  "next_mode",
  "prev_mode",
  "set_flow_state",
  "next_flow_scene",
  "prev_flow_scene",
  "set_flow_scene",
]);

function isVisualActionType(type) {
  return VISUAL_ACTION_TYPES.has(type);
}

export function createPendingVisualAction(type, optimisticState, nowMs = Date.now()) {
  if (!isVisualActionType(type) || !optimisticState?.activeMode) {
    return null;
  }

  const tracksFlowTarget =
    optimisticState.activeMode === "flow" ||
    type === "set_flow_state" ||
    type === "next_flow_scene" ||
    type === "prev_flow_scene" ||
    type === "set_flow_scene";

  return {
    type,
    targetMode: optimisticState.activeMode,
    targetFlowState: tracksFlowTarget ? optimisticState.flow?.state ?? null : null,
    targetFlowSceneId: tracksFlowTarget ? optimisticState.flow?.sceneId ?? null : null,
    startedAtMs: nowMs,
    expiresAtMs: nowMs + PENDING_VISUAL_SYNC_TIMEOUT_MS,
  };
}

function doesPendingVisualActionMatchState(pending, nextState) {
  if (!pending || !nextState) {
    return false;
  }

  if (nextState.activeMode !== pending.targetMode) {
    return false;
  }

  if (pending.targetMode === "flow" || pending.targetFlowState || pending.targetFlowSceneId) {
    if (pending.targetFlowState && nextState.flow?.state !== pending.targetFlowState) {
      return false;
    }

    if (pending.targetFlowSceneId && nextState.flow?.sceneId !== pending.targetFlowSceneId) {
      return false;
    }
  }

  return true;
}

function mergeFlowPlaybackVisualState(nextPlayback = {}, visualPlayback = {}) {
  return {
    ...nextPlayback,
    trackTitle: visualPlayback.trackTitle ?? nextPlayback.trackTitle,
    artist: visualPlayback.artist ?? nextPlayback.artist,
    source: visualPlayback.source ?? nextPlayback.source,
    format: visualPlayback.format ?? nextPlayback.format,
    nextTrackTitle: visualPlayback.nextTrackTitle ?? nextPlayback.nextTrackTitle,
    currentTrackIndex: visualPlayback.currentTrackIndex ?? nextPlayback.currentTrackIndex,
    queueLength: visualPlayback.queueLength ?? nextPlayback.queueLength,
  };
}

function mergePendingVisualState(nextState, visualState, pending) {
  if (!nextState || !visualState) {
    return nextState;
  }

  const mergedState = {
    ...nextState,
    activeMode: visualState.activeMode,
    focusedPanel: visualState.focusedPanel,
    transition: visualState.transition ?? nextState.transition,
  };

  if (pending?.targetMode === "flow" || pending?.targetFlowState || pending?.targetFlowSceneId) {
    mergedState.flow = {
      ...nextState.flow,
      state: visualState.flow?.state ?? nextState.flow?.state,
      subtitle: visualState.flow?.subtitle ?? nextState.flow?.subtitle,
      sceneId: visualState.flow?.sceneId ?? nextState.flow?.sceneId,
      sceneIndex: visualState.flow?.sceneIndex ?? nextState.flow?.sceneIndex,
      scenesByState: visualState.flow?.scenesByState ?? nextState.flow?.scenesByState,
    };
    mergedState.playback = mergeFlowPlaybackVisualState(nextState.playback, visualState.playback);
  }

  return mergedState;
}

export function reconcilePendingVisualState(nextState, pending, visualState, nowMs = Date.now()) {
  if (!pending) {
    return {
      state: nextState,
      pending: null,
      pendingActive: false,
    };
  }

  if (!nextState || nowMs >= pending.expiresAtMs) {
    return {
      state: nextState,
      pending: null,
      pendingActive: false,
    };
  }

  if (doesPendingVisualActionMatchState(pending, nextState)) {
    return {
      state: nextState,
      pending: null,
      pendingActive: false,
    };
  }

  return {
    state: mergePendingVisualState(nextState, visualState, pending),
    pending,
    pendingActive: true,
  };
}
