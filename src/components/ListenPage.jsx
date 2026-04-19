export function ListenPage({ state, onTogglePlay, onSetVolume }) {
  return (
    <main className="mode-page mode-page--listen" role="application" aria-label="Listen mode">
      <section className="mode-panel mode-panel--hero">
        <div className="listen-cover" aria-hidden="true" />
        <div className="listen-copy">
          <span className="mode-kicker">Listen</span>
          <h1>{state.playback.trackTitle ?? "Nothing playing"}</h1>
          <p>{state.playback.artist ?? "Unknown artist"}</p>
          <strong>{state.playback.album ?? state.playback.source ?? "Unknown source"}</strong>
        </div>
      </section>

      <section className="mode-panel mode-panel--side">
        <div className="mode-metric">
          <span>Status</span>
          <strong>{state.playback.state}</strong>
        </div>
        <div className="mode-metric">
          <span>Source</span>
          <strong>{state.playback.source}</strong>
        </div>
        <div className="mode-metric">
          <span>Format</span>
          <strong>{state.playback.format}</strong>
        </div>
        <div className="mode-metric">
          <span>Next</span>
          <strong>{state.playback.nextTrackTitle}</strong>
        </div>
        <div className="listen-controls">
          <button className="shell-button" onClick={onTogglePlay} type="button">
            {state.playback.state === "play" ? "Pause" : "Play"}
          </button>
          <label className="listen-volume">
            <span>Volume {state.playback.volume}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={state.playback.volume}
              onChange={(event) => onSetVolume(Number(event.target.value))}
            />
          </label>
        </div>
      </section>
    </main>
  );
}
