function OverviewCard({
  mode,
  label,
  title,
  subtitle,
  meta,
  onOpen,
  controls,
  tone = "cool",
  detail,
  transitionStatus = "idle",
  isFocusTarget = false,
  isKeyboardFocused = false,
}) {
  const stateClass = isFocusTarget
    ? transitionStatus === "animating"
      ? "is-activating"
      : "is-focused"
    : transitionStatus === "animating"
      ? "is-dimmed"
      : isKeyboardFocused
        ? "is-focused"
        : "";

  return (
    <article
      className={`overview-card overview-card--${tone} ${stateClass}`.trim()}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`Open ${mode}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="overview-card__header">
        <span>{label}</span>
      </div>
      <div className="overview-card__body">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
        {meta ? <strong>{meta}</strong> : null}
        {detail ? <small>{detail}</small> : null}
      </div>
      {controls ? (
        <div
          className="overview-card__controls"
          onClick={(event) => event.stopPropagation()}
          role="group"
          aria-label={`${label} quick controls`}
        >
          {controls}
        </div>
      ) : null}
    </article>
  );
}

function formatPomodoro(remainingSec) {
  const totalSeconds = Math.max(0, Number(remainingSec ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function OverviewPage({
  state,
  onOpenMode,
  onPrevTrack,
  onTogglePlay,
  onNextTrack,
  onSetFlowState,
  onStartPomodoro,
  onResumePomodoro,
  onPausePomodoro,
  onResetPomodoro,
  onCompleteTask,
  focusTarget = null,
  activeCard = "listen",
  className = "",
}) {
  const isRunning = state.screen.pomodoroState === "running";
  const isPaused = state.screen.pomodoroState === "paused";
  const transitionStatus = state.transition?.status ?? "idle";

  return (
    <main className={`overview-page ${className}`.trim()} role="application" aria-label="Overview">
      <section className="overview-grid">
        <OverviewCard
          mode="listen"
          label="Listen"
          title={state.playback.trackTitle ?? "Nothing playing"}
          subtitle={state.playback.artist}
          meta={`${state.playback.source ?? "Unknown source"} · Volume ${state.playback.volume}%`}
          detail={`Next ${state.playback.nextTrackTitle ?? "Unknown"}`}
          tone="listen"
          transitionStatus={transitionStatus}
          isFocusTarget={focusTarget === "listen"}
          isKeyboardFocused={activeCard === "listen"}
          onOpen={() => onOpenMode("listen")}
          controls={(
            <>
              <button className="overview-action overview-action--ghost" onClick={onPrevTrack} type="button">
                Prev
              </button>
              <button className="overview-action" onClick={onTogglePlay} type="button">
                {state.playback.state === "play" ? "Pause" : "Play"}
              </button>
              <button className="overview-action overview-action--ghost" onClick={onNextTrack} type="button">
                Next
              </button>
            </>
          )}
        />
        <OverviewCard
          mode="flow"
          label="Flow"
          title={String(state.flow.state ?? "focus").toUpperCase()}
          subtitle={state.flow.subtitle}
          meta="Enter the current ambient state"
          detail={`Beat ${Math.round((state.flow.audioMetrics?.beatConfidence ?? 0.12) * 100)}%`}
          tone="flow"
          transitionStatus={transitionStatus}
          isFocusTarget={focusTarget === "flow"}
          isKeyboardFocused={activeCard === "flow"}
          onOpen={() => onOpenMode("flow")}
          controls={(
            <div className="overview-chip-list">
              {["focus", "flow", "relax", "sleep"].map((item) => (
                <button
                  key={item}
                  className={`overview-chip ${state.flow.state === item ? "is-active" : ""}`}
                  onClick={() => onSetFlowState(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        />
        <OverviewCard
          mode="screen"
          label="Screen"
          title={state.screen.currentTask ?? "No focus item"}
          subtitle={`${formatPomodoro(state.screen.pomodoroRemainingSec)} left`}
          meta={`${state.screen.todaySummary?.remainingTasks ?? 0} tasks left today`}
          detail={`Next ${state.screen.nextTask ?? "None"}`}
          tone="screen"
          transitionStatus={transitionStatus}
          isFocusTarget={focusTarget === "screen"}
          isKeyboardFocused={activeCard === "screen"}
          onOpen={() => onOpenMode("screen")}
          controls={(
            <>
              <button
                className="overview-action"
                onClick={isPaused ? onResumePomodoro : onStartPomodoro}
                type="button"
              >
                {isRunning ? "Restart" : isPaused ? "Resume" : "Start"}
              </button>
              <button
                className="overview-action overview-action--ghost"
                onClick={onPausePomodoro}
                type="button"
                disabled={!isRunning}
              >
                Pause
              </button>
              <button className="overview-action overview-action--ghost" onClick={onResetPomodoro} type="button">
                Reset
              </button>
              <button className="overview-action overview-action--ghost" onClick={onCompleteTask} type="button">
                Done
              </button>
            </>
          )}
        />
      </section>
    </main>
  );
}
