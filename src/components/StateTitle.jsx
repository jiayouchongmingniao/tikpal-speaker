export function StateTitle({ title, subtitle, appPhase }) {
  return (
    <header className={`state-title phase-${appPhase}`}>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}
