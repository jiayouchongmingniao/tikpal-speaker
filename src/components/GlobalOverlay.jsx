import { getOverlayScreenViewModel, getOverlayStatusHint } from "../viewmodels/screenContextConsumers";

function formatPomodoro(remainingSec) {
  const totalSeconds = Math.max(0, Number(remainingSec ?? 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function ScreenControls({ state, screenContext, onStartPomodoro, onResumePomodoro, onPausePomodoro, onResetPomodoro, onCompleteTask }) {
  const screenView = getOverlayScreenViewModel(state, screenContext);
  const isRunning = screenView.isRunning;
  const isPaused = screenView.isPaused;

  return (
    <div className="global-overlay__section global-overlay__section--mode" role="group" aria-label="Screen controls">
      <span className="global-overlay__label">Screen</span>
      <div className="global-overlay__row">
        <button
          type="button"
          className="global-overlay__button"
          data-overlay-action="screen-primary"
          onClick={isPaused ? onResumePomodoro : onStartPomodoro}
        >
          {isRunning ? "Restart" : isPaused ? "Resume" : "Start"}
        </button>
        <button
          type="button"
          className="global-overlay__button global-overlay__button--ghost"
          data-overlay-action="screen-pause"
          onClick={onPausePomodoro}
          disabled={!isRunning}
        >
          Pause
        </button>
        <button
          type="button"
          className="global-overlay__button global-overlay__button--ghost"
          data-overlay-action="screen-reset"
          onClick={onResetPomodoro}
        >
          Reset
        </button>
        <button
          type="button"
          className="global-overlay__button global-overlay__button--ghost"
          data-overlay-action="screen-complete"
          onClick={onCompleteTask}
        >
          Done
        </button>
      </div>
      <p className="global-overlay__hint">{screenView.hint}</p>
    </div>
  );
}

function ListenControls({ state, onPrevTrack, onTogglePlay, onNextTrack }) {
  return (
    <div className="global-overlay__section global-overlay__section--mode" role="group" aria-label="Listen controls">
      <span className="global-overlay__label">Listen</span>
      <div className="global-overlay__row">
        <button
          type="button"
          className="global-overlay__button global-overlay__button--ghost"
          data-overlay-action="listen-prev"
          onClick={onPrevTrack}
        >
          Prev
        </button>
        <button
          type="button"
          className="global-overlay__button"
          data-overlay-action="play-toggle"
          onClick={onTogglePlay}
        >
          {state.playback.state === "play" ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          className="global-overlay__button global-overlay__button--ghost"
          data-overlay-action="listen-next"
          onClick={onNextTrack}
        >
          Next
        </button>
      </div>
      <p className="global-overlay__hint">{state.playback.trackTitle ?? "Nothing playing"}</p>
    </div>
  );
}

function FlowControls({ state, onSetFlowState }) {
  return (
    <div className="global-overlay__section global-overlay__section--mode" role="group" aria-label="Flow controls">
      <span className="global-overlay__label">Flow</span>
      <div className="global-overlay__row">
        {["focus", "flow", "relax", "sleep"].map((item) => (
          <button
            key={item}
            type="button"
            className={`global-overlay__chip ${state.flow.state === item ? "is-active" : ""}`}
            data-overlay-action={`flow-${item}`}
            onClick={() => onSetFlowState(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GlobalOverlay({
  overlayRef,
  focusIndex = 0,
  visible,
  state,
  screenContext,
  onReturnOverview,
  onModeChange,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  onSetVolume,
  onSetFlowState,
  onStartPomodoro,
  onResumePomodoro,
  onPausePomodoro,
  onResetPomodoro,
  onCompleteTask,
  onInteract,
}) {
  const statusHint = getOverlayStatusHint(state, screenContext);

  return (
    <section
      ref={overlayRef}
      className={`global-overlay ${visible ? "is-visible" : ""}`}
      aria-hidden={!visible}
      onPointerDown={onInteract}
    >
      <div className="global-overlay__panel">
        <div className="global-overlay__section">
          <span className="global-overlay__label">Mode</span>
          <div className="global-overlay__row">
            <button
              type="button"
              className="global-overlay__button global-overlay__button--ghost"
              data-overlay-action="mode-overview"
              data-overlay-focused={focusIndex === 0 ? "true" : "false"}
              onClick={onReturnOverview}
            >
              Overview
            </button>
            {["listen", "flow", "screen"].map((mode) => (
              <button
                key={mode}
                type="button"
                className={`global-overlay__chip ${state.activeMode === mode ? "is-active" : ""}`}
                data-overlay-action={`mode-${mode}`}
                data-overlay-focused={focusIndex === ["listen", "flow", "screen"].indexOf(mode) + 1 ? "true" : "false"}
                onClick={() => onModeChange(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="global-overlay__section">
          <span className="global-overlay__label">Volume</span>
          <div className="global-overlay__row global-overlay__row--volume">
            <button
              type="button"
              className="global-overlay__button"
              data-overlay-action="play-toggle"
              data-overlay-focused={focusIndex === 4 ? "true" : "false"}
              onClick={onTogglePlay}
            >
              {state.playback.state === "play" ? "Pause" : "Play"}
            </button>
            <label className="global-overlay__volume">
              <span>{state.playback.volume}%</span>
              <input
                data-overlay-action="volume"
                data-overlay-focused={focusIndex === 5 ? "true" : "false"}
                type="range"
                min="0"
                max="100"
                value={state.playback.volume}
                onChange={(event) => onSetVolume(Number(event.target.value))}
              />
            </label>
          </div>
        </div>

        {state.activeMode === "listen" ? (
          <ListenControls state={state} onPrevTrack={onPrevTrack} onTogglePlay={onTogglePlay} onNextTrack={onNextTrack} />
        ) : null}
        {state.activeMode === "flow" ? <FlowControls state={state} onSetFlowState={onSetFlowState} /> : null}
        {state.activeMode === "screen" ? (
          <ScreenControls
            state={state}
            screenContext={screenContext}
            onStartPomodoro={onStartPomodoro}
            onResumePomodoro={onResumePomodoro}
            onPausePomodoro={onPausePomodoro}
            onResetPomodoro={onResetPomodoro}
            onCompleteTask={onCompleteTask}
          />
        ) : null}

        {statusHint ? (
          <div className="global-overlay__section global-overlay__section--status">
            <span className="global-overlay__label">Status</span>
            <p className="global-overlay__hint">{statusHint}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
