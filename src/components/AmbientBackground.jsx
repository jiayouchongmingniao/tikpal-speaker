import { FLOW_THEME } from "../theme";

export function AmbientBackground({ currentState, transitionState, appPhase = "immersive", renderProfile = "off" }) {
  const baseTheme = FLOW_THEME[currentState] ?? FLOW_THEME.focus;
  const nextTheme =
    transitionState && FLOW_THEME[transitionState.to]
      ? FLOW_THEME[transitionState.to]
      : baseTheme;
  const isTransitioning = appPhase === "transitioning";
  const isStableProfile = renderProfile === "balanced" || renderProfile === "stable";
  const nextOpacity = isTransitioning ? 0.52 : renderProfile === "stable" ? 0.32 : isStableProfile ? 0.38 : 0.48;
  const nextBlur = renderProfile === "stable" ? "blur(4px)" : isStableProfile ? "blur(6px)" : "blur(10px)";
  const nextBlendMode = renderProfile === "stable" ? "screen" : isStableProfile ? "soft-light" : "screen";
  const baseOpacity = isTransitioning ? 0.98 : 0.92;
  const auraOpacity = isTransitioning ? 0.16 : renderProfile === "stable" ? 0.18 : isStableProfile ? 0.24 : 0.3;
  const auraBlur = renderProfile === "stable" ? "blur(20px)" : isStableProfile ? "blur(24px)" : "blur(30px)";

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
      <div
        className="ambient-bg__layer ambient-bg__layer--depth"
        style={{
          background: `radial-gradient(circle at 50% 62%, ${baseTheme.glow}00 0%, ${baseTheme.glow}22 28%, transparent 66%),
            radial-gradient(circle at 84% 18%, ${nextTheme.glow}33 0%, transparent 32%),
            radial-gradient(circle at 16% 82%, ${baseTheme.accent}22 0%, transparent 30%)`,
          opacity: auraOpacity,
          filter: auraBlur,
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}
