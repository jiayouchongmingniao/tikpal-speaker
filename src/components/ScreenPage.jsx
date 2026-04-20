function formatPomodoro(remainingSec) {
  const totalSeconds = Math.max(0, Number(remainingSec ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ScreenPage({ state, onStartPomodoro, onPausePomodoro, onCompleteTask, className = "" }) {
  const duration = Math.max(1, Number(state.screen.pomodoroDurationSec ?? 1500));
  const remaining = Math.max(0, Number(state.screen.pomodoroRemainingSec ?? duration));
  const progressPercent = Math.max(0, Math.min(100, Math.round(((duration - remaining) / duration) * 100)));
  const isRunning = state.screen.pomodoroState === "running";
  const primaryLabel = isRunning ? "Restart timer" : state.screen.pomodoroState === "paused" ? "Resume timer" : "Start timer";

  return (
    <main className={`mode-page mode-page--screen ${className}`.trim()} role="application" aria-label="Screen mode">
      <section className="mode-panel mode-panel--hero">
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
      </section>

      <section className="mode-panel mode-panel--side">
        <div className="mode-metric">
          <span>Next</span>
          <strong>{state.screen.nextTask ?? "None"}</strong>
        </div>
        <div className="mode-metric">
          <span>Block</span>
          <strong>{state.screen.currentBlockTitle ?? "No block"}</strong>
        </div>
        <div className="mode-metric">
          <span>Today</span>
          <strong>{state.screen.todaySummary?.remainingTasks ?? 0} tasks left</strong>
        </div>
        <div className="mode-metric">
          <span>Calendar</span>
          <strong>{state.screen.todaySummary?.remainingEvents ?? 0} events left</strong>
        </div>
        <div className="listen-controls">
          <button className="shell-button" onClick={onStartPomodoro} type="button">
            {primaryLabel}
          </button>
          <button className="shell-button shell-button--ghost" onClick={onPausePomodoro} type="button">
            Pause
          </button>
          <button className="shell-button shell-button--ghost" onClick={onCompleteTask} type="button">
            Complete
          </button>
        </div>
      </section>
    </main>
  );
}
