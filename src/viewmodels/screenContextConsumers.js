function formatPomodoro(remainingSec) {
  const totalSeconds = Math.max(0, Number(remainingSec ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getScreenSyncStatus(state, screenContext) {
  if (screenContext?.sync?.stale) {
    return "stale";
  }

  return state?.screen?.sync?.status ?? "unknown";
}

export function getScreenPageViewModel(state, screenContext) {
  const context = screenContext ?? {};
  const pomodoro = context.pomodoro ?? {};
  const duration = Math.max(1, Number(pomodoro.durationSec ?? state?.screen?.pomodoroDurationSec ?? 1500));
  const remaining = Math.max(0, Number(pomodoro.remainingSec ?? state?.screen?.pomodoroRemainingSec ?? duration));
  const progressPercent = Math.max(0, Math.min(100, Math.round(((duration - remaining) / duration) * 100)));
  const pomodoroState = pomodoro.state ?? state?.screen?.pomodoroState ?? "idle";

  return {
    duration,
    remaining,
    progressPercent,
    pomodoroState,
    isRunning: pomodoroState === "running",
    isPaused: pomodoroState === "paused",
    focusTitle: context.focusItem?.title ?? state?.screen?.currentTask ?? "No focus item",
    boundTask: context.focusItem?.title ?? state?.screen?.pomodoroFocusTask ?? state?.screen?.currentTask ?? null,
    currentBlockTitle: context.currentBlock?.title ?? state?.screen?.currentBlockTitle ?? "No active block",
    nextTitle: context.nextBlock?.title ?? state?.screen?.nextTask ?? "None",
    remainingTasks: context.todaySummary?.remainingTasks ?? state?.screen?.todaySummary?.remainingTasks ?? 0,
    remainingEvents: context.todaySummary?.remainingEvents ?? state?.screen?.todaySummary?.remainingEvents ?? 0,
    syncStatus: getScreenSyncStatus(state, screenContext),
  };
}

export function getOverviewScreenCardViewModel(state, screenContext) {
  const screen = getScreenPageViewModel(state, screenContext);
  return {
    title: screen.focusTitle,
    subtitle: `${formatPomodoro(screen.remaining)} left`,
    meta: `${screen.remainingTasks} tasks left today`,
    detail: `Next ${screen.nextTitle}`,
    isRunning: screen.isRunning,
    isPaused: screen.isPaused,
  };
}

export function getPortableScreenCardViewModel(state, screenContext) {
  const screen = getScreenPageViewModel(state, screenContext);
  return {
    title: screen.focusTitle,
    timerLabel: `${formatPomodoro(screen.remaining)} · ${screen.pomodoroState}`,
    nextTitle: screen.nextTitle,
    pomodoroState: screen.pomodoroState,
  };
}

export function getOverlayScreenViewModel(state, screenContext) {
  const screen = getScreenPageViewModel(state, screenContext);
  return {
    isRunning: screen.isRunning,
    isPaused: screen.isPaused,
    hint: `${screen.focusTitle} · ${formatPomodoro(screen.remaining)} left`,
  };
}

export function getOverlayStatusHint(state, screenContext) {
  if (state?.system?.otaStatus === "applying") {
    return "Applying update";
  }

  if (state?.controller?.activeSessionCount > 0) {
    return `${state.controller.activeSessionCount} controller connected`;
  }

  if (screenContext?.sync?.stale || state?.screen?.sync?.stale) {
    return "Screen sync stale";
  }

  if (state?.system?.performanceTier && state.system.performanceTier !== "normal") {
    return `Performance ${state.system.performanceTier}`;
  }

  return null;
}
