import { getScreenPageViewModel } from "../viewmodels/screenContextConsumers";
import { getCreativeCareViewModel } from "../viewmodels/creativeCare";

function formatPomodoro(remainingSec) {
  const totalSeconds = Math.max(0, Number(remainingSec ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ScreenPage({
  state,
  screenContext,
  onOpenMode,
  onReturnOverview,
  onStartPomodoro,
  onResumePomodoro,
  onPausePomodoro,
  onResetPomodoro,
  onCompleteTask,
  className = "",
}) {
  const viewModel = getScreenPageViewModel(state, screenContext);
  const creativeCare = getCreativeCareViewModel(state);
  const { duration, remaining, progressPercent, isRunning, isPaused, focusTitle, boundTask, currentBlockTitle, nextTitle, remainingTasks, remainingEvents, syncStatus, pomodoroState } =
    viewModel;
  const primaryLabel = isRunning ? "Restart timer" : isPaused ? "Resume timer" : "Start timer";
  const currentTime = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <main className={`mode-page mode-page--screen ${className}`.trim()} role="application" aria-label="Screen mode">
      <section className="mode-panel mode-panel--surface mode-panel--screen-surface">
        <div className="screen-layout">
          <div className="screen-hero">
            <span className="mode-kicker">Session Compass</span>
            <h1>{creativeCare.intention}</h1>
            <p>{creativeCare.nextGentleAction}</p>
            <div className="screen-timer">
              <strong>{formatPomodoro(remaining)} left</strong>
              <div className="screen-timer__rail">
                <div className="screen-timer__fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <span>{pomodoroState}</span>
            </div>
            <p className="screen-focus-binding">Bound to {boundTask ?? focusTitle ?? "no task"} · {state.screen.completedPomodoros ?? 0} sessions done</p>
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
              <p>{focusTitle} · {syncStatus === "mock" ? "Local fallback context" : syncStatus === "stale" ? "Context stale" : "Connected context"}</p>
            </div>
            <div className="screen-sidebar__panel screen-sidebar__panel--care">
              <span className="mode-kicker">Mood</span>
              <strong>{creativeCare.moodText}</strong>
              <p>{creativeCare.flowLabel} · {creativeCare.insightSentence}</p>
            </div>
            <div className="screen-sidebar__panel">
              <span className="mode-kicker">Next</span>
              <strong>{nextTitle}</strong>
              <p>{remainingTasks} tasks left today</p>
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
            <strong>{nextTitle}</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Today</span>
            <strong>{remainingTasks} tasks left</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Calendar</span>
            <strong>{remainingEvents} events left</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Block</span>
            <strong>{currentBlockTitle}</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Sync</span>
            <strong>{syncStatus}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
