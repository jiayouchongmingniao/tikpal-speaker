function OverviewCard({ label, title, subtitle, meta, onOpen, controls, tone = "cool", detail }) {
  return (
    <article className={`overview-card overview-card--${tone}`} onClick={onOpen} role="button" tabIndex={0}>
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

export function OverviewPage({ state, onOpenMode, onTogglePlay, onSetFlowState, onPausePomodoro, className = "" }) {
  return (
    <main className={`overview-page ${className}`.trim()} role="application" aria-label="Overview">
      <header className="overview-header">
        <div>
          <span className="mode-kicker">Overview</span>
          <h1>Ambient OS</h1>
          <p>Listen, Flow, and Screen share the same surface.</p>
        </div>
      </header>
      <section className="overview-grid">
        <OverviewCard
          label="Listen"
          title={state.playback.trackTitle ?? "Nothing playing"}
          subtitle={state.playback.artist}
          meta={`${state.playback.source ?? "Unknown source"} · Volume ${state.playback.volume}%`}
          detail={`Next ${state.playback.nextTrackTitle ?? "Unknown"}`}
          tone="listen"
          onOpen={() => onOpenMode("listen")}
          controls={(
            <button className="overview-action" onClick={onTogglePlay} type="button">
              {state.playback.state === "play" ? "Pause" : "Play"}
            </button>
          )}
        />
        <OverviewCard
          label="Flow"
          title={String(state.flow.state ?? "focus").toUpperCase()}
          subtitle={state.flow.subtitle}
          meta="Enter the current ambient state"
          detail={`Beat ${Math.round((state.flow.audioMetrics?.beatConfidence ?? 0.12) * 100)}%`}
          tone="flow"
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
          label="Screen"
          title={state.screen.currentTask ?? "No focus item"}
          subtitle={`${formatPomodoro(state.screen.pomodoroRemainingSec)} left`}
          meta={`${state.screen.todaySummary?.remainingTasks ?? 0} tasks left today`}
          detail={`Next ${state.screen.nextTask ?? "None"}`}
          tone="screen"
          onOpen={() => onOpenMode("screen")}
          controls={(
            <button className="overview-action" onClick={onPausePomodoro} type="button">
              {state.screen.pomodoroState === "running" ? "Pause timer" : "Resume timer"}
            </button>
          )}
        />
      </section>
    </main>
  );
}
