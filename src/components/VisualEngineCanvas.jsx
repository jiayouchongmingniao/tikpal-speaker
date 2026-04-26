import { useEffect, useRef } from "react";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function VisualEngineCanvas({ currentState, theme, audioMetrics, appPhase, renderBudget }) {
  const canvasRef = useRef(null);
  const currentStateRef = useRef(currentState);
  const themeRef = useRef(theme);
  const audioMetricsRef = useRef(audioMetrics);
  const appPhaseRef = useRef(appPhase);
  const renderBudgetRef = useRef(renderBudget);
  const resizeRequestedRef = useRef(false);

  useEffect(() => {
    currentStateRef.current = currentState;
    themeRef.current = theme;
    audioMetricsRef.current = audioMetrics;
    appPhaseRef.current = appPhase;
    renderBudgetRef.current = renderBudget;
    resizeRequestedRef.current = true;
  }, [appPhase, audioMetrics, currentState, renderBudget, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let frameId = 0;
    let frameIndex = 0;
    let disposed = false;

    function resize() {
      const budget = renderBudgetRef.current ?? {};
      const ratio = Math.min(window.devicePixelRatio || 1, budget.pixelRatioCap ?? 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function drawWaveLayer(time, layerIndex) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const liveTheme = themeRef.current;
      const liveMetrics = audioMetricsRef.current;
      const midY = height * 0.5 + layerIndex * 24;
      const amplitude =
        height * (liveTheme.motionAmplitude * 0.22 + liveMetrics.lowEnergy * 0.08 + layerIndex * 0.014);
      const speed = liveTheme.motionSpeed * (0.7 + liveMetrics.beatConfidence * 0.6 + layerIndex * 0.12);
      const alpha = clamp(0.12 + layerIndex * 0.08 + liveMetrics.highEnergy * 0.1, 0.12, 0.42);

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

    function drawParticles(time) {
      const liveState = currentStateRef.current;
      const liveTheme = themeRef.current;
      const liveMetrics = audioMetricsRef.current;
      const budget = renderBudgetRef.current ?? {};

      if (!["flow", "relax"].includes(liveState)) {
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;
      const count = Math.max(4, Math.floor(liveTheme.particleDensity * 120 * (budget.particleMultiplier ?? 1)));

      for (let index = 0; index < count; index += 1) {
        const seed = index / count;
        const x = (seed * width * 1.7 + time * 14 * (1 + liveMetrics.highEnergy)) % width;
        const y = height * (0.18 + ((seed * 1.31 + time * 0.01) % 0.64));
        const radius = 1 + ((index % 5) + liveMetrics.highEnergy * 6) * 0.28;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = `${liveTheme.glow}30`;
        context.fill();
      }
    }

    function render() {
      if (disposed) {
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;
      const time = performance.now() / 1000;
      const liveState = currentStateRef.current;
      const liveMetrics = audioMetricsRef.current;
      const livePhase = appPhaseRef.current;
      const budget = renderBudgetRef.current ?? {};
      const brightness = 0.84 + liveMetrics.volumeNormalized * 0.15;
      const dimAlpha = livePhase === "sleep_dimmed" ? 0.34 : 0.12;
      frameIndex += 1;
      const frameModulo = Math.max(1, Number(budget.frameModulo ?? 1));

      if (resizeRequestedRef.current) {
        resizeRequestedRef.current = false;
        resize();
      }

      if (frameModulo > 1 && frameIndex % frameModulo !== 0) {
        frameId = window.requestAnimationFrame(render);
        return;
      }

      context.clearRect(0, 0, width, height);

      context.fillStyle = `rgba(0, 0, 0, ${1 - brightness})`;
      context.fillRect(0, 0, width, height);

      const desiredLayerCount = liveState === "flow" ? 3 : 2;
      const layerCount = Math.min(desiredLayerCount, budget.maxWaveLayers ?? desiredLayerCount);
      for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
        drawWaveLayer(time, layerIndex);
      }

      drawParticles(time);

      context.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
      context.fillRect(0, 0, width, height);

      frameId = window.requestAnimationFrame(render);
    }

    resize();
    render();
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="visual-canvas" aria-hidden="true" />;
}
