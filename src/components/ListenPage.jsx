function formatProgress(progress) {
  const normalized = Math.max(0, Math.min(1, Number(progress ?? 0)));
  const totalSeconds = Math.round(normalized * 222);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ListenPage({ state, onTogglePlay, onPrevTrack, onNextTrack, onSetVolume, className = "" }) {
  const progressPercent = Math.round(Math.max(0, Math.min(1, Number(state.playback.progress ?? 0))) * 100);

  return (
    <main className={`mode-page mode-page--listen ${className}`.trim()} role="application" aria-label="Listen mode">
      <section className="mode-panel mode-panel--surface">
        <div className="listen-layout">
          <div className="listen-cover" aria-hidden="true" />
          <div className="listen-copy">
            <span className="mode-kicker">Listen</span>
            <h1>{state.playback.trackTitle ?? "Nothing playing"}</h1>
            <p>{state.playback.artist ?? "Unknown artist"}</p>
            <strong>{state.playback.album ?? state.playback.source ?? "Unknown source"}</strong>
            <div className="listen-progress">
              <div className="listen-progress__rail">
                <div className="listen-progress__fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="listen-progress__meta">
                <span>{formatProgress(state.playback.progress)}</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="listen-controls listen-controls--inline">
          <button className="shell-button shell-button--ghost" type="button" onClick={onPrevTrack}>
            Prev
          </button>
          <button className="shell-button" onClick={onTogglePlay} type="button">
            {state.playback.state === "play" ? "Pause" : "Play"}
          </button>
          <button className="shell-button shell-button--ghost" type="button" onClick={onNextTrack}>
            Next
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

        <div className="mode-meta-strip" role="list" aria-label="Listen details">
          <div className="mode-metric" role="listitem">
            <span>Status</span>
            <strong>{state.playback.state}</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Source</span>
            <strong>{state.playback.source}</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Format</span>
            <strong>{state.playback.format}</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Next</span>
            <strong>{state.playback.nextTrackTitle}</strong>
          </div>
          <div className="mode-metric" role="listitem">
            <span>Queue</span>
            <strong>{state.playback.currentTrackIndex + 1} of {state.playback.queueLength ?? 1}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
