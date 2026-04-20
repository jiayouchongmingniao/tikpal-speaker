export function ControlOverlay({
  visible,
  currentState,
  stateOrder,
  playbackState,
  volume,
  onTogglePlay,
  onVolumeChange,
  onStateSelect,
  onBack,
}) {
  return (
    <section className={`control-overlay ${visible ? "is-visible" : ""}`}>
      <button type="button" className="control-pill" onClick={onTogglePlay}>
        {playbackState === "play" ? "Pause" : "Play"}
      </button>
      <div className="control-volume">
        <span>Volume</span>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          aria-label="Volume"
        />
      </div>
      <div className="control-state-list" role="tablist" aria-label="Flow states">
        {stateOrder.map((state) => (
          <button
            key={state}
            type="button"
            className={`control-chip ${state === currentState ? "is-active" : ""}`}
            onClick={() => onStateSelect(state)}
          >
            {state}
          </button>
        ))}
      </div>
      <button type="button" className="control-pill control-pill--ghost" onClick={onBack}>
        Back
      </button>
    </section>
  );
}
