import { getCreativeCareViewModel } from "../viewmodels/creativeCare";

const VISUAL_BARS = [42, 68, 36, 84, 54, 72, 48, 88, 60, 74, 46, 64];

function formatProgress(progress) {
  const normalized = Math.max(0, Math.min(1, Number(progress ?? 0)));
  const totalSeconds = Math.round(normalized * 222);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ListenPage({ state, onTogglePlay, onPrevTrack, onNextTrack, onSetVolume, className = "" }) {
  const progressPercent = Math.round(Math.max(0, Math.min(1, Number(state.playback.progress ?? 0))) * 100);
  const creativeCare = getCreativeCareViewModel(state);
  const queueLength = Math.max(1, Number(state.playback.queueLength ?? 1));
  const currentTrackIndex = Math.max(0, Number(state.playback.currentTrackIndex ?? 0));
  const nextTrackTitle = state.playback.nextTrackTitle ?? "To be announced";
  const isPlaying = state.playback.state === "play";
  const stopShellGesture = (event) => {
    event.stopPropagation();
  };

  return (
    <main className={`mode-page mode-page--listen ${className}`.trim()} role="application" aria-label="Listen mode">
      <section className="mode-panel mode-panel--surface">
        <div className="listen-stage">
          <div className="listen-visual" aria-hidden="true">
            <div className="listen-disc">
              <div className="listen-disc__ring" />
              <div className="listen-disc__center" />
            </div>
            <div className="listen-wave">
              {VISUAL_BARS.map((height, index) => (
                <span key={height + index} style={{ "--bar-height": `${height}%` }} />
              ))}
            </div>
          </div>

          <div className="listen-copy">
            <div className="listen-copy__eyebrow">
              <span className="mode-kicker">Listen In</span>
              <span>{isPlaying ? "Playing" : "Paused"}</span>
            </div>
            <h1>{state.playback.trackTitle ?? creativeCare.soundscape}</h1>
            <p>{creativeCare.insightSentence}</p>
            <strong>{creativeCare.soundscape}</strong>
          </div>

          <aside className="creative-care-panel" aria-label="Voice insight">
            <span className="mode-kicker">Voice Insight</span>
            <strong>{creativeCare.moodText} / {creativeCare.careText}</strong>
            <p>{creativeCare.intention}</p>
            <div className="listen-context-list" role="list">
              <div role="listitem">
                <span>Source</span>
                <strong>{state.playback.source ?? "Tikpal"}</strong>
              </div>
              <div role="listitem">
                <span>Next</span>
                <strong>{nextTrackTitle}</strong>
              </div>
              <div role="listitem">
                <span>Queue</span>
                <strong>{Math.min(currentTrackIndex + 1, queueLength)} of {queueLength}</strong>
              </div>
            </div>
          </aside>
        </div>

        <div
          className="listen-dock"
          onPointerDown={stopShellGesture}
          onTouchStart={stopShellGesture}
          onTouchMove={stopShellGesture}
          onTouchEnd={stopShellGesture}
        >
          <div className="listen-transport" aria-label="Playback controls">
            <button className="transport-button transport-button--prev" type="button" onClick={onPrevTrack} aria-label="Previous track">
              <span className="transport-glyph transport-glyph--prev" aria-hidden="true" />
            </button>
            <button className="transport-button transport-button--primary" onClick={onTogglePlay} type="button" aria-label={isPlaying ? "Pause" : "Play"}>
              <span className={`transport-glyph ${isPlaying ? "transport-glyph--pause" : "transport-glyph--play"}`} aria-hidden="true" />
            </button>
            <button className="transport-button transport-button--next" type="button" onClick={onNextTrack} aria-label="Next track">
              <span className="transport-glyph transport-glyph--next" aria-hidden="true" />
            </button>
          </div>

          <div className="listen-progress" aria-label="Playback progress">
            <div className="listen-progress__meta">
              <span>{formatProgress(state.playback.progress)}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="listen-progress__rail">
              <div className="listen-progress__fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

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

          <div className="listen-dock__status">
            <span>{creativeCare.flowLabel}</span>
            <strong>{creativeCare.flowSubtitle}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
