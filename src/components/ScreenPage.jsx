function formatPomodoro(remainingSec) {
  const totalSeconds = Math.max(0, Number(remainingSec ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ScreenPage({
  state,
  onOpenMode,
  onReturnOverview,
  onStartPomodoro,
  onResumePomodoro,
  onPausePomodoro,
  onResetPomodoro,
  onCompleteTask,
  className = "",
}) {
  const duration = Math.max(1, Number(state.screen.pomodoroDurationSec ?? 1500));
  const remaining = Math.max(0, Number(state.screen.pomodoroRemainingSec ?? duration));
  const progressPercent = Math.max(0, Math.min(100, Math.round(((duration - remaining) / duration) * 100)));
  const isRunning = state.screen.pomodoroState === "running";
  const isPaused = state.screen.pomodoroState === "paused";
  const primaryLabel = isRunning ? "Restart timer" : isPaused ? "Resume timer" : "Start timer";
  const boundTask = state.screen.pomodoroFocusTask ?? state.screen.currentTask;
  const currentTime = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <main className={`mode-page mode-page--screen ${className}`.trim()} role="application" aria-label="Screen mode">
      <section className="mode-panel mode-panel--surface mode-panel--screen-surface">
        <div className="screen-layout">
          <div className="screen-hero">
            <span className="mode-kicker">Screen</span>
            <h1>{state.screen.currentTask ?? "No focus item"}</h1>
            <p>{state.screen.currentBlockTitle ?? "No active block"}</p>
            <div className="screen-timer">
              <strong>{formatPomodoro(remaining)} left</strong>
              <div className="screen-timer__rail">
                <div className="screen-timer__fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <span>{state.screen.pomodoroState}</span>
            </div>
            <p className="screen-focus-binding">Bound to {boundTask ?? "no task"} · {state.screen.completedPomodoros ?? 0} sessions done</p>
            <div className="listen-controls listen-controls--inline">
              <button className="shell-button" onClick={isPaused ? onResumePomodoro : onStartPomodoro} type="button">
                {primaryLabel}
              </button>
              <button className="shell-button shell-button--ghost" onClick={onPausePomodoro} type="button" disabled={!isRunning}>
                Pause
              </button>
              <button className="shell-button shell-button--ghost" onClick={onResetPomodoro} type="button">
                Reset
              </button>
              <button className="shell-button shell-button--ghost" onClick={onCompleteTask} type="button">
                Complete
              </button>
            </div>
          </div>

          <aside className="screen-sidebar">
            <div className="screen-sidebar__panel">
              <span className="mode-kicker">Now</span>
              <strong>{currentTime}</strong>
              <p>{state.screen.sync?.status === "mock" ? "Local fallback context" : "Connected context"}</p>
            </div>
            <div className="screen-sidebar__panel">
              <span className="mode-kicker">Next</span>
              <strong>{state.screen.nextTask ?? "None"}</strong>
              <p>{state.screen.todaySummary?.remainingTasks ?? 0} tasks left today</p>
            </div>
            <div className="screen-sidebar__panel">
              <span className="mode-kicker">Jump</span>
              <div className="screen-nav">
                <button className="shell-button shell-button--ghost" onClick={onReturnOverview} type="button">
                  Overview
                </button>
                <button className="shell-button shell-button--ghost" onClick={() => onOpenMode("listen")} type="button">
                  Listen
                </button>
                <button className="shell-button shell-button--ghost" onClick={() => onOpenMode("flow")} type="button">
                  Flow
                </button>
              </div>
            </div>
          </aside>
        </div>

        <div className="mode-meta-strip" role="list" aria-label="Screen details">
          <div className="mode-metric" role="listitem">
            <span>Next</span>
            <strong>{state.screen.nextTask ?? "None"}</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Today</span>
            <strong>{state.screen.todaySummary?.remainingTasks ?? 0} tasks left</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Calendar</span>
            <strong>{state.screen.todaySummary?.remainingEvents ?? 0} events left</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Block</span>
            <strong>{state.screen.currentBlockTitle ?? "No block"}</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Sync</span>
            <strong>{state.screen.sync?.status ?? "unknown"}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
