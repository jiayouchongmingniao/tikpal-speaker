function formatClock() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function SideInfoPanel({ playerState, volume, visible }) {
  return (
    <aside className={`side-info ${visible ? "is-visible" : ""}`}>
      <div className="side-info__item">
        <span className="side-info__label">Time</span>
        <strong>{formatClock()}</strong>
      </div>
      <div className="side-info__item">
        <span className="side-info__label">Volume</span>
        <strong>{volume}%</strong>
      </div>
      <div className="side-info__item">
        <span className="side-info__label">Track</span>
        <strong>{playerState.trackTitle ?? "No Track"}</strong>
      </div>
      <div className="side-info__item">
        <span className="side-info__label">Source</span>
        <strong>{playerState.source ?? "Unknown"}</strong>
      </div>
    </aside>
  );
}
