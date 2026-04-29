import { useEffect, useRef } from "react";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundMetric(value, digits = 3) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}

export function VisualEngineCanvas({ currentState, theme, audioMetrics, appPhase, renderBudget, flowDiagnosticMode = "off" }) {
  const canvasRef = useRef(null);
  const currentStateRef = useRef(currentState);
  const themeRef = useRef(theme);
  const audioMetricsRef = useRef(audioMetrics);
  const appPhaseRef = useRef(appPhase);
  const renderBudgetRef = useRef(renderBudget);
  const flowDiagnosticModeRef = useRef(flowDiagnosticMode);
  const resizeRequestedRef = useRef(false);
  const staticSceneDirtyRef = useRef(true);
  const canvasMetricsRef = useRef({
    skippedRenderCount: 0,
    resizeCommitCount: 0,
    transitionFrameBudgetHits: 0,
    lastFrameIntervalMs: 16,
  });
  const viewportRef = useRef({
    width: 0,
    height: 0,
    ratio: 1,
    effectiveRatio: 1,
  });
  const smoothedMetricsRef = useRef({
    volumeNormalized: audioMetrics?.volumeNormalized ?? 0.58,
    lowEnergy: audioMetrics?.lowEnergy ?? 0.28,
    midEnergy: audioMetrics?.midEnergy ?? 0.22,
    highEnergy: audioMetrics?.highEnergy ?? 0.18,
    beatConfidence: audioMetrics?.beatConfidence ?? 0.12,
    isPlaying: audioMetrics?.isPlaying ?? true,
  });

  useEffect(() => {
    currentStateRef.current = currentState;
    themeRef.current = theme;
    audioMetricsRef.current = audioMetrics;
    appPhaseRef.current = appPhase;
    flowDiagnosticModeRef.current = flowDiagnosticMode;
    const previousBudget = renderBudgetRef.current ?? {};
    renderBudgetRef.current = renderBudget;
    if (
      (previousBudget.pixelRatioCap ?? 2) !== (renderBudget?.pixelRatioCap ?? 2) ||
      (previousBudget.renderScale ?? 1) !== (renderBudget?.renderScale ?? 1)
    ) {
      resizeRequestedRef.current = true;
    }
    staticSceneDirtyRef.current = true;
  }, [appPhase, audioMetrics, currentState, flowDiagnosticMode, renderBudget, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let frameId = 0;
    let lastRenderedAt = 0;
    let disposed = false;

    function requestResize() {
      resizeRequestedRef.current = true;
      staticSceneDirtyRef.current = true;
    }

    function resize({ preserveFrame = false } = {}) {
      const budget = renderBudgetRef.current ?? {};
      const ratio = Math.min(window.devicePixelRatio || 1, budget.pixelRatioCap ?? 2);
      const renderScale = Math.max(0.25, Math.min(1, Number(budget.renderScale ?? 1)));
      const effectiveRatio = ratio * renderScale;
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (
        preserveFrame &&
        viewportRef.current.width === width &&
        viewportRef.current.height === height &&
        viewportRef.current.ratio === ratio &&
        viewportRef.current.effectiveRatio === effectiveRatio
      ) {
        return false;
      }

      canvas.width = Math.max(1, Math.floor(width * effectiveRatio));
      canvas.height = Math.max(1, Math.floor(height * effectiveRatio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(effectiveRatio, 0, 0, effectiveRatio, 0, 0);
      viewportRef.current = { width, height, ratio, effectiveRatio };
      canvasMetricsRef.current.resizeCommitCount += 1;
      staticSceneDirtyRef.current = true;
      return true;
    }

    function drawWaveLayer(time, layerIndex, liveMetrics) {
      const { width, height } = viewportRef.current;
      const liveTheme = themeRef.current;
      const midY = height * 0.5 + layerIndex * 24;
      const amplitude =
        height * (liveTheme.motionAmplitude * 0.22 + liveMetrics.lowEnergy * 0.08 + layerIndex * 0.014);
      const speed = liveTheme.motionSpeed * (0.7 + liveMetrics.beatConfidence * 0.6 + layerIndex * 0.12);
      const alpha = clamp(0.14 + layerIndex * 0.08 + liveMetrics.highEnergy * 0.12, 0.14, 0.48);

      context.beginPath();
      context.moveTo(0, height);

      const budget = renderBudgetRef.current ?? {};
      const step = budget.waveStep ?? 18;

      for (let x = 0; x <= width; x += step) {
        const normalized = x / width;
        const falloff = 1 - Math.pow(Math.abs(normalized - 0.5) * 1.8, 2);
        const y =
          midY +
          Math.sin(normalized * 8 + time * speed + layerIndex * 0.7) * amplitude * falloff +
          Math.cos(normalized * 13 + time * speed * 0.7) * amplitude * 0.2 * falloff;
        context.lineTo(x, y);
      }

      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = `${liveTheme.accent}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`;
      context.fill();
    }

    function drawParticles(time, liveMetrics, particleScale = 1, options = {}) {
      const liveState = currentStateRef.current;
      const liveTheme = themeRef.current;
      const budget = renderBudgetRef.current ?? {};
      const {
        alphaHex = "30",
        driftMultiplier = 14,
        verticalOffset = 0,
        radiusMultiplier = 1,
        horizontalSpread = 1.7,
      } = options;

      if (!["flow", "relax"].includes(liveState)) {
        return;
      }

      const { width, height } = viewportRef.current;
      const count = Math.floor(liveTheme.particleDensity * 120 * (budget.particleMultiplier ?? 1) * particleScale);
      if (count < 1) {
        return;
      }

      for (let index = 0; index < count; index += 1) {
        const seed = index / count;
        const x = (seed * width * horizontalSpread + time * driftMultiplier * (1 + liveMetrics.highEnergy)) % width;
        const y = height * (0.18 + ((seed * 1.31 + verticalOffset + time * 0.01) % 0.64));
        const radius = (1 + ((index % 5) + liveMetrics.highEnergy * 6) * 0.28) * radiusMultiplier;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = `${liveTheme.glow}${alphaHex}`;
        context.fill();
      }
    }

    function drawBloomMotes(time, liveMetrics, particleScale = 1) {
      const liveTheme = themeRef.current;
      const budget = renderBudgetRef.current ?? {};
      const { width, height } = viewportRef.current;
      const count = Math.round((budget.maxWaveLayers ?? 1) * 2 * particleScale);
      if (count < 1) {
        return;
      }

      context.save();
      context.globalCompositeOperation = "screen";
      for (let index = 0; index < count; index += 1) {
        const seed = (index + 1) / (count + 1);
        const x = (width * (0.12 + seed * 0.78) + Math.sin(time * 0.22 + index) * width * 0.06) % width;
        const y = height * (0.2 + ((seed * 1.9 + time * 0.018) % 0.5));
        const radius = 18 + seed * 34 + liveMetrics.highEnergy * 18;
        const orb = context.createRadialGradient(x, y, 0, x, y, radius);
        orb.addColorStop(0, `${liveTheme.glow}2c`);
        orb.addColorStop(0.42, `${liveTheme.accent}12`);
        orb.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = orb;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
      context.restore();
    }

    function drawLightVeil(time, liveMetrics) {
      const { width, height } = viewportRef.current;
      const liveTheme = themeRef.current;
      const pulse = 0.16 + liveMetrics.midEnergy * 0.12 + Math.sin(time * 0.4) * 0.03;
      const veilGradient = context.createRadialGradient(width * 0.52, height * 0.56, height * 0.08, width * 0.52, height * 0.56, height * 0.72);
      veilGradient.addColorStop(0, `${liveTheme.glow}1e`);
      veilGradient.addColorStop(0.32, `${liveTheme.accent}12`);
      veilGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = clamp(pulse, 0.14, 0.28);
      context.fillStyle = veilGradient;
      context.fillRect(0, 0, width, height);
      context.restore();
    }

    function renderStaticDiagnosticScene(width, height, liveTheme) {
      const staticMetrics = {
        lowEnergy: 0.16,
        highEnergy: 0.08,
        beatConfidence: 0.1,
      };
      context.save();
      context.globalCompositeOperation = "source-over";
      context.fillStyle = "rgba(2, 3, 5, 0.12)";
      context.fillRect(0, 0, width, height);
      context.restore();

      drawWaveLayer(0, 0, staticMetrics);

      const vignette = context.createLinearGradient(0, 0, 0, height);
      vignette.addColorStop(0, `${liveTheme.glow}10`);
      vignette.addColorStop(0.5, "rgba(2, 3, 5, 0)");
      vignette.addColorStop(1, "rgba(2, 3, 5, 0.2)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);
    }

    function render(nowMs) {
      if (disposed) {
        return;
      }

      if (resizeRequestedRef.current) {
        resizeRequestedRef.current = false;
        resize({ preserveFrame: true });
      }

      const budget = renderBudgetRef.current ?? {};
      const diagnosticMode = flowDiagnosticModeRef.current ?? "off";
      const sceneMode = budget.flowSceneMode ?? "animated";
      const isStaticScene = diagnosticMode === "static" || sceneMode === "static" || sceneMode === "minimal";
      const isMinimalScene = diagnosticMode !== "static" && sceneMode === "minimal";
      const frameIntervalMs = Math.max(16, Number(budget.frameIntervalMs ?? 16));
      const isLowPowerBudget =
        Number(budget.pixelRatioCap ?? 1) <= 0.85 ||
        Number(budget.particleMultiplier ?? 1) <= 0.08 ||
        Number(budget.maxWaveLayers ?? 1) <= 1;
      if (lastRenderedAt && nowMs - lastRenderedAt < frameIntervalMs) {
        canvasMetricsRef.current.skippedRenderCount += 1;
        frameId = window.requestAnimationFrame(render);
        return;
      }
      canvasMetricsRef.current.lastFrameIntervalMs = roundMetric(lastRenderedAt ? nowMs - lastRenderedAt : frameIntervalMs, 2);
      lastRenderedAt = nowMs;

      const { width, height } = viewportRef.current;
      const time = isStaticScene ? 0 : nowMs / 1000;
      const liveState = currentStateRef.current;
      const liveMetrics = audioMetricsRef.current;
      const livePhase = appPhaseRef.current;
      const smoothing = livePhase === "transitioning" ? 0.08 : 0.18;
      const previousMetrics = smoothedMetricsRef.current;
      const smoothedMetrics = {
        volumeNormalized: previousMetrics.volumeNormalized + (liveMetrics.volumeNormalized - previousMetrics.volumeNormalized) * smoothing,
        lowEnergy: previousMetrics.lowEnergy + (liveMetrics.lowEnergy - previousMetrics.lowEnergy) * smoothing,
        midEnergy: previousMetrics.midEnergy + (liveMetrics.midEnergy - previousMetrics.midEnergy) * smoothing,
        highEnergy: previousMetrics.highEnergy + (liveMetrics.highEnergy - previousMetrics.highEnergy) * smoothing,
        beatConfidence: previousMetrics.beatConfidence + (liveMetrics.beatConfidence - previousMetrics.beatConfidence) * smoothing,
        isPlaying: liveMetrics.isPlaying,
      };
      smoothedMetricsRef.current = smoothedMetrics;
      const volumeLift = smoothedMetrics.volumeNormalized * 0.1;
      const energyLift = smoothedMetrics.highEnergy * 0.06;
      const brightness = clamp(0.89 + volumeLift + energyLift, 0.87, 0.985);
      const dimAlpha = livePhase === "sleep_dimmed" ? 0.24 : livePhase === "transitioning" ? 0.14 : 0.08;
      const fadeAlpha = livePhase === "transitioning" ? 0.18 : livePhase === "sleep_dimmed" ? 0.16 : 0.09;
      const backgroundAlpha = clamp(1 - brightness, 0.03, 0.12);
      const desiredLayerCount = isStaticScene ? 1 : livePhase === "transitioning" ? 1 : liveState === "flow" ? 3 : 2;
      const layerCount = Math.min(desiredLayerCount, budget.maxWaveLayers ?? desiredLayerCount);

      if (isStaticScene && !staticSceneDirtyRef.current) {
        window.__TIKPAL_CANVAS_DEBUG__ = {
          ...canvasMetricsRef.current,
          width,
          height,
          ratio: viewportRef.current.ratio,
          renderScale: Number(budget.renderScale ?? 1),
          effectiveRatio: viewportRef.current.effectiveRatio,
          desiredLayerCount,
          layerCount,
          flowDiagnosticMode: diagnosticMode,
          staticSceneActive: true,
          lowPowerBudget: isLowPowerBudget,
          flowSceneMode: sceneMode,
          phase: livePhase,
        };
        frameId = window.requestAnimationFrame(render);
        return;
      }

      context.save();
      context.globalCompositeOperation = "source-over";
      context.fillStyle = `rgba(2, 3, 5, ${fadeAlpha})`;
      context.fillRect(0, 0, width, height);
      context.restore();

      context.fillStyle = `rgba(2, 3, 5, ${backgroundAlpha})`;
      context.fillRect(0, 0, width, height);

      if (isStaticScene) {
        if (staticSceneDirtyRef.current) {
          renderStaticDiagnosticScene(width, height, themeRef.current);
          staticSceneDirtyRef.current = false;
        }
      } else {
        for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
          drawWaveLayer(time, layerIndex, smoothedMetrics);
        }

        if (livePhase !== "transitioning" && !isLowPowerBudget && !isMinimalScene) {
          drawLightVeil(time, smoothedMetrics);
        }

        if (!isMinimalScene) {
          const particleScale =
            livePhase === "transitioning" ? 0.12 : livePhase === "sleep_dimmed" ? 0 : liveState === "flow" ? 0.92 : 0.78;
          const primaryParticleScale = isLowPowerBudget ? particleScale * 0.42 : particleScale;
          drawParticles(time, smoothedMetrics, primaryParticleScale, {
            alphaHex: livePhase === "transitioning" ? "18" : "36",
            driftMultiplier: isLowPowerBudget ? 10 : 14,
          });
          if (!isLowPowerBudget && livePhase !== "transitioning" && particleScale > 0) {
            drawParticles(time + 11, smoothedMetrics, particleScale * 0.52, {
              alphaHex: "26",
              driftMultiplier: 8,
              verticalOffset: 0.23,
              radiusMultiplier: 0.72,
              horizontalSpread: 1.28,
            });
            drawBloomMotes(time, smoothedMetrics, particleScale * 0.9);
          }
        }
      }

      context.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
      context.fillRect(0, 0, width, height);

      if (livePhase === "transitioning") {
        canvasMetricsRef.current.transitionFrameBudgetHits += 1;
      }

      window.__TIKPAL_CANVAS_DEBUG__ = {
        ...canvasMetricsRef.current,
        width,
        height,
        ratio: viewportRef.current.ratio,
        renderScale: Number(budget.renderScale ?? 1),
        effectiveRatio: viewportRef.current.effectiveRatio,
        desiredLayerCount,
        layerCount,
        flowDiagnosticMode: diagnosticMode,
        staticSceneActive: isStaticScene,
        lowPowerBudget: isLowPowerBudget,
        flowSceneMode: sceneMode,
        phase: livePhase,
      };

      frameId = window.requestAnimationFrame(render);
    }

    resize();
    frameId = window.requestAnimationFrame(render);
    window.addEventListener("resize", requestResize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", requestResize);
      delete window.__TIKPAL_CANVAS_DEBUG__;
    };
  }, []);

  return <canvas ref={canvasRef} className="visual-canvas" aria-hidden="true" />;
}
