import { getCreativeCareViewModel, getFlowCareCopy } from "../viewmodels/creativeCare";
import { getOverviewScreenCardViewModel } from "../viewmodels/screenContextConsumers";

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
  screenContext,
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
  const screenCard = getOverviewScreenCardViewModel(state, screenContext);
  const creativeCare = getCreativeCareViewModel(state);
  const isRunning = screenCard.isRunning;
  const isPaused = screenCard.isPaused;
  const transitionStatus = state.transition?.status ?? "idle";

  return (
    <main className={`overview-page ${className}`.trim()} role="application" aria-label="Overview">
      <section className="overview-grid">
        <OverviewCard
          mode="listen"
          label="Listen In"
          title={creativeCare.soundscape}
          subtitle={creativeCare.insightSentence}
          meta={`${creativeCare.moodText} · Volume ${state.playback.volume}%`}
          detail={state.playback.trackTitle ?? "Ambient support"}
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
          title={getFlowCareCopy(state.flow.state ?? "focus").label}
          subtitle={creativeCare.intention}
          meta={`Suggested ${creativeCare.flowLabel}`}
          detail={creativeCare.nextGentleAction}
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
                  {getFlowCareCopy(item).label}
                </button>
              ))}
            </div>
          )}
        />
        <OverviewCard
          mode="screen"
          label="Screen"
          title={screenCard.title}
          subtitle={screenCard.subtitle}
          meta={screenCard.meta}
          detail={screenCard.detail}
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
