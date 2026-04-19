function formatPomodoro(remainingSec) {
  const totalSeconds = Math.max(0, Number(remainingSec ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ScreenPage({ state, onStartPomodoro, onPausePomodoro, onCompleteTask }) {
  return (
    <main className="mode-page mode-page--screen" role="application" aria-label="Screen mode">
      <section className="mode-panel mode-panel--hero">
        <span className="mode-kicker">Screen</span>
        <h1>{state.screen.currentTask ?? "No focus item"}</h1>
        <p>{state.screen.currentBlockTitle ?? "No active block"}</p>
        <strong>{formatPomodoro(state.screen.pomodoroRemainingSec)} left</strong>
      </section>

      <section className="mode-panel mode-panel--side">
        <div className="mode-metric">
          <span>Next</span>
          <strong>{state.screen.nextTask ?? "None"}</strong>
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
            {state.screen.pomodoroState === "running" ? "Restart timer" : "Start timer"}
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
