import { useEffect, useRef } from "react";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function VisualEngineCanvas({ currentState, theme, audioMetrics, appPhase }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let frameId = 0;
    let disposed = false;

    function resize() {
      const ratio = window.devicePixelRatio || 1;
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
      const midY = height * 0.5 + layerIndex * 24;
      const amplitude = height * (theme.motionAmplitude * 0.22 + audioMetrics.lowEnergy * 0.08 + layerIndex * 0.014);
      const speed = theme.motionSpeed * (0.7 + audioMetrics.beatConfidence * 0.6 + layerIndex * 0.12);
      const alpha = clamp(0.12 + layerIndex * 0.08 + audioMetrics.highEnergy * 0.1, 0.12, 0.42);

      context.beginPath();
      context.moveTo(0, height);

      for (let x = 0; x <= width; x += 18) {
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
      context.fillStyle = `${theme.accent}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`;
      context.fill();
    }

    function drawParticles(time) {
      if (!["flow", "relax"].includes(currentState)) {
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;
      const count = Math.floor(theme.particleDensity * 120);

      for (let index = 0; index < count; index += 1) {
        const seed = index / count;
        const x = ((seed * width * 1.7 + time * 14 * (1 + audioMetrics.highEnergy)) % width);
        const y = height * (0.18 + ((seed * 1.31 + time * 0.01) % 0.64));
        const radius = 1 + ((index % 5) + audioMetrics.highEnergy * 6) * 0.28;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = `${theme.glow}30`;
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
      const brightness = 0.84 + audioMetrics.volumeNormalized * 0.15;
      const dimAlpha = appPhase === "sleep_dimmed" ? 0.34 : 0.12;

      context.clearRect(0, 0, width, height);

      context.fillStyle = `rgba(0, 0, 0, ${1 - brightness})`;
      context.fillRect(0, 0, width, height);

      const layerCount = currentState === "flow" ? 3 : 2;
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
  }, [appPhase, audioMetrics, currentState, theme]);

  return <canvas ref={canvasRef} className="visual-canvas" aria-hidden="true" />;
}
