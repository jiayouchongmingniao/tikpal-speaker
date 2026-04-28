import { useEffect, useRef } from "react";
import createRegl from "regl";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(color, fallback = [0.4, 0.5, 0.9]) {
  const value = String(color ?? "").trim().replace("#", "");
  if (!/^[\da-fA-F]{6}$/.test(value)) {
    return fallback;
  }

  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ];
}

function getStateCode(currentState) {
  if (currentState === "sleep") {
    return 2;
  }

  if (currentState === "relax") {
    return 1;
  }

  return 0;
}

export function FlowWebGLCanvas({
  currentState,
  theme,
  audioMetrics,
  appPhase,
  renderBudget,
  onReady,
  onInitError,
  onContextLost,
  onFallback,
}) {
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
    let frameId = 0;
    let reglInstance = null;
    let draw = null;
    let disposed = false;
    let lastRenderedAt = 0;
    let fallbackTriggered = false;
    let glInitErrors = 0;
    let glContextLostCount = 0;
    let glFrameErrorCount = 0;

    function triggerFallback(reason) {
      if (fallbackTriggered) {
        return;
      }

      fallbackTriggered = true;
      onFallback?.(reason ?? "gl_fallback");
    }

    function resize(gl) {
      const budget = renderBudgetRef.current ?? {};
      const ratio = Math.min(window.devicePixelRatio || 1, budget.pixelRatioCap ?? 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function onLost(event) {
      event.preventDefault();
      glContextLostCount += 1;
      onContextLost?.(glContextLostCount);
      if (glContextLostCount >= 2) {
        triggerFallback("gl_context_lost_threshold");
      }
    }

    function onRestored() {
      triggerFallback("gl_context_restored_reinitialize");
    }

    async function init() {
      if (!canvas) {
        return;
      }

      const gl = canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
      });

      if (!gl) {
        glInitErrors += 1;
        onInitError?.(glInitErrors);
        triggerFallback("webgl2_unavailable");
        return;
      }

      canvas.addEventListener("webglcontextlost", onLost);
      canvas.addEventListener("webglcontextrestored", onRestored);

      try {
        reglInstance = createRegl({
          gl,
        });
      } catch {
        glInitErrors += 1;
        onInitError?.(glInitErrors);
        triggerFallback("regl_init_failed");
        return;
      }

      draw = reglInstance({
        vert: `#version 300 es
precision mediump float;
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`,
        frag: `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uAccent;
uniform vec3 uGlow;
uniform float uAmplitude;
uniform float uSpeed;
uniform float uLow;
uniform float uHigh;
uniform float uVolume;
uniform float uParticle;
uniform float uLayerCount;
uniform float uDimAlpha;
uniform float uStateCode;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = vUv;
  float wave = 0.0;
  for (int index = 0; index < 3; index += 1) {
    float layer = float(index);
    if (layer >= uLayerCount) {
      break;
    }
    float layerFactor = 1.0 - layer * 0.25;
    float freq = 6.0 + layer * 2.4;
    float speed = uSpeed * (0.7 + layer * 0.16);
    wave += sin((uv.x * freq) + (uTime * speed) + (layer * 0.8)) * (uAmplitude * layerFactor);
  }

  float center = 0.55 + wave * 0.18 + (uLow - 0.2) * 0.06;
  float dist = abs(uv.y - center);
  float waveBand = smoothstep(0.18, 0.0, dist);

  vec3 base = mix(uGlow * 0.35, uAccent * (0.9 + uHigh * 0.5), waveBand);
  float sleepShift = step(1.5, uStateCode);
  base *= mix(1.0, 0.52, sleepShift);

  vec2 grid = floor(uv * vec2(120.0, 68.0) + vec2(uTime * 0.18, uTime * 0.13));
  float sparkle = step(0.992 - uParticle * 0.4, hash(grid));
  float sparkleMask = smoothstep(0.2, 0.8, uv.y) * (0.25 + uVolume * 0.75);
  vec3 particles = uGlow * sparkle * sparkleMask;

  vec3 color = base + particles;
  color = mix(color, vec3(0.0), uDimAlpha);
  fragColor = vec4(color, 1.0);
}`,
        attributes: {
          position: reglInstance.buffer([
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ]),
        },
        uniforms: {
          uResolution: ({ viewportWidth, viewportHeight }) => [viewportWidth, viewportHeight],
          uTime: (_, props) => props.time,
          uAccent: (_, props) => props.accent,
          uGlow: (_, props) => props.glow,
          uAmplitude: (_, props) => props.amplitude,
          uSpeed: (_, props) => props.speed,
          uLow: (_, props) => props.lowEnergy,
          uHigh: (_, props) => props.highEnergy,
          uVolume: (_, props) => props.volume,
          uParticle: (_, props) => props.particle,
          uLayerCount: (_, props) => props.layerCount,
          uDimAlpha: (_, props) => props.dimAlpha,
          uStateCode: (_, props) => props.stateCode,
        },
        count: 4,
        primitive: "triangle strip",
      });

      resize(gl);
      onReady?.();

      function render(nowMs) {
        if (disposed || fallbackTriggered) {
          return;
        }

        try {
          if (resizeRequestedRef.current) {
            resizeRequestedRef.current = false;
            resize(gl);
          }

          const budget = renderBudgetRef.current ?? {};
          const frameIntervalMs = Math.max(16, Number(budget.frameIntervalMs ?? 16));
          if (lastRenderedAt && nowMs - lastRenderedAt < frameIntervalMs) {
            frameId = window.requestAnimationFrame(render);
            return;
          }
          lastRenderedAt = nowMs;

          const liveTheme = themeRef.current;
          const liveMetrics = audioMetricsRef.current;
          const livePhase = appPhaseRef.current;
          const liveState = currentStateRef.current;

          reglInstance.poll();
          reglInstance.clear({
            color: [0, 0, 0, 1],
            depth: 1,
          });
          draw({
            time: nowMs / 1000,
            accent: hexToRgb(liveTheme.accent, [0.36, 0.49, 1]),
            glow: hexToRgb(liveTheme.glow, [0.49, 0.56, 1]),
            amplitude: clamp(liveTheme.motionAmplitude * 0.9 + liveMetrics.lowEnergy * 0.2, 0.05, 0.8),
            speed: clamp(liveTheme.motionSpeed * (0.9 + liveMetrics.beatConfidence * 0.7), 0.03, 2),
            lowEnergy: clamp(liveMetrics.lowEnergy, 0, 1),
            highEnergy: clamp(liveMetrics.highEnergy, 0, 1),
            volume: clamp(liveMetrics.volumeNormalized, 0, 1),
            particle: clamp((budget.particleMultiplier ?? 0.2) * (0.5 + liveMetrics.highEnergy), 0, 1),
            layerCount: clamp(Number(budget.maxWaveLayers ?? 1), 1, 3),
            dimAlpha: livePhase === "sleep_dimmed" ? 0.42 : 0.12,
            stateCode: getStateCode(liveState),
          });
        } catch {
          glFrameErrorCount += 1;
          if (glFrameErrorCount >= 3) {
            triggerFallback("gl_frame_error_threshold");
            return;
          }
        }

        frameId = window.requestAnimationFrame(render);
      }

      frameId = window.requestAnimationFrame(render);
    }

    init();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      if (canvas) {
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
      }
      if (reglInstance) {
        reglInstance.destroy();
      }
    };
  }, [onContextLost, onFallback, onInitError, onReady]);

  return <canvas ref={canvasRef} className="visual-canvas" aria-hidden="true" />;
}
