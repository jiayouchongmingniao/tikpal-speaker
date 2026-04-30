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
  const primaryLabel = isRunning ? "Restart" : isPaused ? "Resume" : "Start";
  const elapsedMinutes = Math.max(0, Math.round((duration - remaining) / 60));
  const currentTime = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const contextLabel = syncStatus === "mock" ? "Local fallback" : syncStatus === "stale" ? "Context stale" : "Connected";
  const stopShellGesture = (event) => {
    event.stopPropagation();
  };

  return (
    <main className={`mode-page mode-page--screen ${className}`.trim()} role="application" aria-label="Screen mode">
      <section className="mode-panel mode-panel--surface mode-panel--screen-surface">
        <div className="screen-stage">
          <header className="screen-header">
            <div>
              <span className="mode-kicker">Session Compass</span>
              <strong>{contextLabel}</strong>
            </div>
            <nav
              className="screen-nav"
              aria-label="Mode switcher"
              onPointerDown={stopShellGesture}
              onTouchStart={stopShellGesture}
              onTouchMove={stopShellGesture}
              onTouchEnd={stopShellGesture}
            >
              <button className="screen-nav__button" onClick={onReturnOverview} type="button">
                Overview
              </button>
              <button className="screen-nav__button" onClick={() => onOpenMode("listen")} type="button">
                Listen
              </button>
              <button className="screen-nav__button" onClick={() => onOpenMode("flow")} type="button">
                Flow
              </button>
            </nav>
          </header>

          <div className="screen-focus-grid">
            <div className="screen-clock">
              <span>Now</span>
              <strong>{currentTime}</strong>
              <p>{creativeCare.nextGentleAction}</p>
            </div>

            <div className="screen-task">
              <span className="mode-kicker">Focus Item</span>
              <h1>{focusTitle}</h1>
              <p>{creativeCare.intention}</p>
              <div className="screen-task__context">
                <span>Current block</span>
                <strong>{currentBlockTitle}</strong>
                <span>Next</span>
                <strong>{nextTitle}</strong>
              </div>
            </div>

            <div className="screen-timer" style={{ "--timer-progress": `${progressPercent}%` }}>
              <div className="screen-timer__ring" aria-hidden="true">
                <div className="screen-timer__inner">
                  <span>{pomodoroState}</span>
                  <strong>{formatPomodoro(remaining)}</strong>
                </div>
              </div>
              <p className="screen-focus-binding">Bound to {boundTask ?? focusTitle ?? "no task"}</p>
            </div>
          </div>

          <div
            className="screen-command-row"
            onPointerDown={stopShellGesture}
            onTouchStart={stopShellGesture}
            onTouchMove={stopShellGesture}
            onTouchEnd={stopShellGesture}
          >
            <button className="screen-command screen-command--primary" onClick={isPaused ? onResumePomodoro : onStartPomodoro} type="button">
              {primaryLabel}
            </button>
            <button className="screen-command" onClick={onPausePomodoro} type="button" disabled={!isRunning}>
              Pause
            </button>
            <button className="screen-command" onClick={onResetPomodoro} type="button">
              Reset
            </button>
            <button className="screen-command" onClick={onCompleteTask} type="button">
              Complete
            </button>
          </div>

          <div className="screen-metrics" role="list" aria-label="Screen details">
            <div role="listitem">
              <span>Elapsed</span>
              <strong>{elapsedMinutes} min</strong>
            </div>
            <div role="listitem">
              <span>Today</span>
              <strong>{remainingTasks} tasks</strong>
            </div>
            <div role="listitem">
              <span>Calendar</span>
              <strong>{remainingEvents} events</strong>
            </div>
            <div role="listitem">
              <span>Mood</span>
              <strong>{creativeCare.moodText}</strong>
            </div>
            <div role="listitem">
              <span>Care</span>
              <strong>{creativeCare.flowLabel}</strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
