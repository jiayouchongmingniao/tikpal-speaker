import { FLOW_THEME } from "../theme";

export function AmbientBackground({
  currentState,
  scene = null,
  previousScene = null,
  transitionState,
  appPhase = "immersive",
  performanceTier = "normal",
  renderProfile = "off",
  flowDiagnosticMode = "off",
  imageOnly = false,
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
  const hasSceneArtwork = Boolean(scene?.artwork);
  const suppressDepthLayers = isLowPowerTier || isStaticDiagnostic || isPiStableProfile;
  const nextOpacityBase = isStaticDiagnostic
    ? 0.34
    : isTransitioning
      ? 0.52
      : renderProfile === "stable"
        ? 0.22
        : isStableProfile
          ? 0.48
          : 0.58;
  const nextOpacity = hasSceneArtwork ? nextOpacityBase * 0.62 : nextOpacityBase;
  const nextBlur =
    isPiStableProfile || isStaticDiagnostic || isLowPowerTier ? "none" : isStableProfile ? "blur(8px)" : "blur(12px)";
  const nextBlendMode =
    isStaticDiagnostic || renderProfile === "stable" || isLowPowerTier ? "normal" : isStableProfile ? "soft-light" : "screen";
  const baseOpacity = hasSceneArtwork ? (isTransitioning ? 0.42 : 0.34) : isTransitioning ? 0.98 : 0.92;
  const auraOpacityBase = isTransitioning ? 0.16 : renderProfile === "stable" ? 0.24 : isStableProfile ? 0.3 : 0.38;
  const auraOpacity = hasSceneArtwork ? auraOpacityBase * 0.38 : auraOpacityBase;
  const auraBlur = renderProfile === "stable" ? "blur(22px)" : isStableProfile ? "blur(28px)" : "blur(34px)";
  const contourOpacityBase = isTransitioning ? 0.12 : renderProfile === "stable" ? 0.16 : isStableProfile ? 0.2 : 0.24;
  const contourOpacity = hasSceneArtwork ? contourOpacityBase * 0.34 : contourOpacityBase;
  const nextLayerBackground = isPiStableProfile
    ? `radial-gradient(ellipse at 42% 44%, ${nextTheme.glow}38 0%, transparent 46%),
      radial-gradient(ellipse at 18% 28%, ${baseTheme.accent}22 0%, transparent 40%)`
    : `radial-gradient(circle at 72% 40%, ${nextTheme.glow} 0%, transparent 38%),
      linear-gradient(160deg, ${nextTheme.bgGradient.join(", ")})`;
  const sceneOpacity = imageOnly ? 1 : isStaticDiagnostic ? 0.42 : isPiStableProfile ? 0.74 : isStableProfile ? 0.82 : 0.9;
  const sceneFilter = isStaticDiagnostic
    ? "saturate(0.96) contrast(1.04)"
    : isPiStableProfile
      ? "saturate(1.02) contrast(1.06) brightness(1.04)"
      : "saturate(1.08) contrast(1.1) brightness(1.05)";
  const sceneVignetteOpacity = imageOnly ? 0.24 : isStaticDiagnostic ? 0.28 : isPiStableProfile ? 0.24 : isStableProfile ? 0.2 : 0.16;
  const shouldRenderThemeLayers = !imageOnly || !scene?.artwork;
  const hasPreviousSceneArtwork = imageOnly && Boolean(previousScene?.artwork) && previousScene?.artwork !== scene?.artwork;
  const isSceneCrossfadeActive = hasPreviousSceneArtwork;
  const currentSceneArtClassName = [
    "ambient-bg__layer",
    "ambient-bg__layer--scene-art",
    imageOnly ? "ambient-bg__layer--scene-art-direct" : "",
    isSceneCrossfadeActive ? "ambient-bg__layer--scene-art-current" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const currentSceneArtStyle = {
    backgroundImage: `url("${scene?.artwork}")`,
    filter: imageOnly ? "none" : sceneFilter,
  };

  if (!isSceneCrossfadeActive) {
    currentSceneArtStyle.opacity = sceneOpacity;
  }
  const previousSceneArtClassName = [
    "ambient-bg__layer",
    "ambient-bg__layer--scene-art",
    "ambient-bg__layer--scene-art-direct",
    "ambient-bg__layer--scene-art-previous",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="ambient-bg" aria-hidden="true">
      {shouldRenderThemeLayers ? (
        <>
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
        </>
      ) : null}
      {scene?.artwork ? (
        <>
          {hasPreviousSceneArtwork ? (
            <div
              className={previousSceneArtClassName}
              style={{ backgroundImage: `url("${previousScene.artwork}")` }}
            />
          ) : null}
          <div
            className={currentSceneArtClassName}
            style={currentSceneArtStyle}
          />
          <div
            className="ambient-bg__layer ambient-bg__layer--scene-vignette"
            style={{
              opacity: sceneVignetteOpacity,
              background: imageOnly
                ? "linear-gradient(180deg, rgba(2, 3, 5, 0.08) 0%, rgba(2, 3, 5, 0.16) 42%, rgba(2, 3, 5, 0.6) 100%)"
                : `linear-gradient(180deg, rgba(5, 7, 14, 0.2) 0%, rgba(5, 7, 14, 0.12) 24%, rgba(5, 7, 14, 0.54) 72%, rgba(5, 7, 14, 0.72) 100%),
                  radial-gradient(circle at 76% 18%, ${nextTheme.glow}20 0%, transparent 24%),
                  radial-gradient(circle at 24% 84%, ${baseTheme.accent}18 0%, transparent 28%)`,
            }}
          />
        </>
      ) : null}
      {!imageOnly && !suppressDepthLayers ? (
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
      {!imageOnly && !suppressDepthLayers ? (
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
