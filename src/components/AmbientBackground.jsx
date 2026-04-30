import { FLOW_THEME } from "../theme";

export function AmbientBackground({
  currentState,
  transitionState,
  appPhase = "immersive",
  performanceTier = "normal",
  renderProfile = "off",
  flowDiagnosticMode = "off",
}) {
  const baseTheme = FLOW_THEME[currentState] ?? FLOW_THEME.focus;
  const nextTheme =
    transitionState && FLOW_THEME[transitionState.to]
      ? FLOW_THEME[transitionState.to]
      : baseTheme;
  const isTransitioning = appPhase === "transitioning";
  const isStableProfile = renderProfile === "balanced" || renderProfile === "stable";
  const isPiStableProfile = renderProfile === "stable";
  const isLowPowerTier = performanceTier === "safe" || (isPiStableProfile && performanceTier !== "normal");
  const isStaticDiagnostic = flowDiagnosticMode === "static";
  const suppressDepthLayers = isLowPowerTier || isStaticDiagnostic || isPiStableProfile;
  const nextOpacity = isStaticDiagnostic
    ? 0.34
    : isTransitioning
      ? 0.52
      : renderProfile === "stable"
        ? 0.22
        : isStableProfile
          ? 0.48
          : 0.58;
  const nextBlur =
    isPiStableProfile || isStaticDiagnostic || isLowPowerTier ? "none" : isStableProfile ? "blur(8px)" : "blur(12px)";
  const nextBlendMode =
    isStaticDiagnostic || renderProfile === "stable" || isLowPowerTier ? "normal" : isStableProfile ? "soft-light" : "screen";
  const baseOpacity = isTransitioning ? 0.98 : 0.92;
  const auraOpacity = isTransitioning ? 0.16 : renderProfile === "stable" ? 0.24 : isStableProfile ? 0.3 : 0.38;
  const auraBlur = renderProfile === "stable" ? "blur(22px)" : isStableProfile ? "blur(28px)" : "blur(34px)";
  const contourOpacity = isTransitioning ? 0.12 : renderProfile === "stable" ? 0.16 : isStableProfile ? 0.2 : 0.24;
  const nextLayerBackground = isPiStableProfile
    ? `radial-gradient(ellipse at 42% 44%, ${nextTheme.glow}38 0%, transparent 46%),
      radial-gradient(ellipse at 18% 28%, ${baseTheme.accent}22 0%, transparent 40%)`
    : `radial-gradient(circle at 72% 40%, ${nextTheme.glow} 0%, transparent 38%),
      linear-gradient(160deg, ${nextTheme.bgGradient.join(", ")})`;

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
          background: nextLayerBackground,
          opacity: transitionState ? nextOpacity : nextOpacity * 0.82,
          filter: nextBlur,
          mixBlendMode: nextBlendMode,
        }}
      />
      {!suppressDepthLayers ? (
        <div
          className="ambient-bg__layer ambient-bg__layer--depth"
          style={{
            background: `radial-gradient(circle at 50% 62%, ${baseTheme.glow}00 0%, ${baseTheme.glow}28 28%, transparent 66%),
              radial-gradient(circle at 84% 18%, ${nextTheme.glow}40 0%, transparent 32%),
              radial-gradient(circle at 16% 82%, ${baseTheme.accent}28 0%, transparent 30%)`,
            opacity: auraOpacity,
            filter: auraBlur,
            mixBlendMode: "screen",
          }}
        />
      ) : null}
      {!suppressDepthLayers ? (
        <div
          className="ambient-bg__layer ambient-bg__layer--contour"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${nextTheme.glow}10 28%, ${baseTheme.accent}1c 54%, transparent 100%),
              radial-gradient(circle at 38% 48%, ${nextTheme.glow}22 0%, transparent 22%),
              radial-gradient(circle at 62% 54%, ${baseTheme.glow}20 0%, transparent 26%)`,
            opacity: contourOpacity,
            filter: "blur(18px)",
            mixBlendMode: "screen",
          }}
        />
      ) : null}
    </div>
  );
}
