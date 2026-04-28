import { FLOW_THEME } from "../theme";

export function AmbientBackground({ currentState, transitionState, appPhase = "immersive", renderProfile = "off" }) {
  const baseTheme = FLOW_THEME[currentState] ?? FLOW_THEME.focus;
  const nextTheme =
    transitionState && FLOW_THEME[transitionState.to]
      ? FLOW_THEME[transitionState.to]
      : baseTheme;
  const isTransitioning = appPhase === "transitioning";
  const isStableProfile = renderProfile === "balanced" || renderProfile === "stable";
  const nextOpacity = isTransitioning ? 0.52 : renderProfile === "stable" ? 0.24 : isStableProfile ? 0.3 : 0.42;
  const nextBlur = isStableProfile ? "none" : "blur(10px)";
  const nextBlendMode = isStableProfile ? "normal" : "screen";
  const baseOpacity = isTransitioning ? 0.98 : 0.92;

  return (
    <div className="ambient-bg" aria-hidden="true">
      <div
        className="ambient-bg__layer ambient-bg__layer--base"
        style={{
          opacity: baseOpacity,
          background: `radial-gradient(circle at 20% 30%, ${baseTheme.bgGradient[2]} 0%, transparent 42%),
            linear-gradient(120deg, ${baseTheme.bgGradient.join(", ")})`,
        }}
      />
      <div
        className="ambient-bg__layer ambient-bg__layer--next"
        style={{
          background: `radial-gradient(circle at 72% 40%, ${nextTheme.glow} 0%, transparent 38%),
            linear-gradient(160deg, ${nextTheme.bgGradient.join(", ")})`,
          opacity: transitionState ? nextOpacity : nextOpacity * 0.82,
          filter: nextBlur,
          mixBlendMode: nextBlendMode,
        }}
      />
    </div>
  );
}
