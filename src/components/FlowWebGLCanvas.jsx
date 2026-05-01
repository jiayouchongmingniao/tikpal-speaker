import { useEffect, useRef } from "react";
import { getWebglPerformanceRenderBudget } from "../viewmodels/performance";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundMetric(value, digits = 3) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}

function hexToRgb(hex, fallback) {
  if (typeof hex !== "string") {
    return fallback;
  }

  const value = hex.trim().replace("#", "");
  if (value.length !== 6) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 16);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return {
    r: ((parsed >> 16) & 255) / 255,
    g: ((parsed >> 8) & 255) / 255,
    b: (parsed & 255) / 255,
  };
}

function setFlowRenderDebugSnapshot(snapshot) {
  window.__TIKPAL_CANVAS_DEBUG__ = snapshot;
}

const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_low;
uniform float u_mid;
uniform float u_high;
uniform float u_transition;
uniform float u_minimal;
uniform vec3 u_accent;
uniform vec3 u_glow;

float wave(float x, float speed, float frequency, float amplitude, float phase) {
  return sin(x * frequency + u_time * speed + phase) * amplitude;
}

void main() {
  vec2 uv = v_uv;
  vec2 centered = uv * 2.0 - 1.0;
  float energy = mix(u_low, u_high, 0.55);

  if (u_minimal > 0.95) {
    float ridge = wave(centered.x, 0.24, 4.2, 0.08 + u_low * 0.04, 0.0);
    float band = 1.0 - smoothstep(0.0, 0.1 + energy * 0.12, abs(centered.y - ridge));
    float vignette = 1.0 - smoothstep(0.2, 1.48, length(centered * vec2(1.0, 0.82)));
    vec3 base = vec3(0.01, 0.015, 0.03);
    vec3 color = base + u_accent * band * (0.28 + u_high * 0.14);
    color *= 0.58 + vignette * 0.42;
    outColor = vec4(color, 1.0);
    return;
  }

  float wake = 0.12 + energy * 0.26;
  float ridgeA = wave(centered.x, 0.52, 5.6, 0.14 + u_low * 0.08, 0.0);
  float ridgeB = wave(centered.x, 0.74, 8.4, 0.09 + u_mid * 0.05, 1.7);
  float ridge = mix(ridgeA + ridgeB, ridgeA, u_minimal);
  float band = 1.0 - smoothstep(0.0, wake, abs(centered.y - ridge));

  float glowWave = wave(centered.x, 0.36, 3.8, 0.22 + u_high * 0.08, 2.4);
  float aura = 1.0 - smoothstep(0.0, 0.95, length(vec2(centered.x * 0.85, centered.y - glowWave * 0.45)));
  float pulse = 0.08 + u_mid * 0.12 + sin(u_time * 0.35) * 0.02;
  float transitionFade = mix(1.0, 0.72, u_transition);

  vec3 base = vec3(0.01, 0.015, 0.03);
  vec3 accent = mix(base, u_accent, band * (0.62 + u_high * 0.24));
  vec3 auraColor = mix(base, u_glow, aura * pulse * transitionFade);
  vec3 color = base + accent + auraColor;

  float vignette = 1.0 - smoothstep(0.2, 1.55, length(centered * vec2(1.0, 0.82)));
  color *= 0.62 + vignette * 0.38;

  outColor = vec4(color, 1.0);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("webgl_shader_create_failed");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "unknown_shader_compile_error";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(gl) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("webgl_program_create_failed");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "unknown_program_link_error";
    gl.deleteProgram(program);
    throw new Error(info);
  }

  return program;
}

export function FlowWebGLCanvas({
  currentState,
  theme,
  audioMetrics,
  appPhase,
  renderBudget,
  rendererMetadata,
  onFallback,
}) {
  const canvasRef = useRef(null);
  const currentStateRef = useRef(currentState);
  const themeRef = useRef(theme);
  const audioMetricsRef = useRef(audioMetrics);
  const appPhaseRef = useRef(appPhase);
  const renderBudgetRef = useRef(renderBudget);
  const rendererMetadataRef = useRef(rendererMetadata);
  const resizeRequestedRef = useRef(false);
  const metricsRef = useRef({
    skippedRenderCount: 0,
    resizeCommitCount: 0,
    transitionFrameBudgetHits: 0,
    lastFrameIntervalMs: 16,
  });
  const viewportRef = useRef({
    width: 0,
    height: 0,
    cssWidth: 0,
    cssHeight: 0,
    ratio: 1,
    renderScale: 1,
    effectiveRatio: 1,
    compositorScaleX: 1,
  });
  const smoothedMetricsRef = useRef({
    lowEnergy: audioMetrics?.lowEnergy ?? 0.28,
    midEnergy: audioMetrics?.midEnergy ?? 0.22,
    highEnergy: audioMetrics?.highEnergy ?? 0.18,
  });

  useEffect(() => {
    currentStateRef.current = currentState;
    themeRef.current = theme;
    audioMetricsRef.current = audioMetrics;
    appPhaseRef.current = appPhase;
    rendererMetadataRef.current = rendererMetadata;
    const previousBudget = renderBudgetRef.current ?? {};
    renderBudgetRef.current = renderBudget;
    if (
      (previousBudget.pixelRatioCap ?? 2) !== (renderBudget?.pixelRatioCap ?? 2) ||
      (previousBudget.renderScale ?? 1) !== (renderBudget?.renderScale ?? 1) ||
      (previousBudget.webglRenderScale ?? previousBudget.renderScale ?? 1) !==
        (renderBudget?.webglRenderScale ?? renderBudget?.renderScale ?? 1)
    ) {
      resizeRequestedRef.current = true;
    }
  }, [appPhase, audioMetrics, currentState, renderBudget, rendererMetadata, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    let gl;
    try {
      gl = canvas.getContext("webgl2", {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
      });
    } catch {
      gl = null;
    }

    if (!gl) {
      onFallback?.("webgl2_unavailable", { glInitErrorDelta: 1 });
      return undefined;
    }

    let program;
    let positionBuffer;
    let vao;
    let frameId = 0;
    let lastRenderedAt = 0;
    let disposed = false;

    const handleContextLost = (event) => {
      event.preventDefault();
      onFallback?.("webgl_context_lost", { glContextLostDelta: 1, rendererFallbackDelta: 1 });
    };

    canvas.addEventListener("webglcontextlost", handleContextLost, false);

    function resize({ preserveFrame = false } = {}) {
      const budget = getWebglPerformanceRenderBudget(renderBudgetRef.current ?? {});
      const ratio = Math.min(window.devicePixelRatio || 1, budget.pixelRatioCap ?? 2);
      const renderScale = Math.max(0.12, Math.min(1, Number(budget.renderScale ?? 1)));
      const effectiveRatio = ratio * renderScale;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const cssWidth = width;
      const cssHeight = height;
      const compositorScaleX = 1;

      if (
        preserveFrame &&
        viewportRef.current.width === width &&
        viewportRef.current.height === height &&
        viewportRef.current.cssWidth === cssWidth &&
        viewportRef.current.cssHeight === cssHeight &&
        viewportRef.current.ratio === ratio &&
        viewportRef.current.renderScale === renderScale &&
        viewportRef.current.effectiveRatio === effectiveRatio &&
        viewportRef.current.compositorScaleX === compositorScaleX
      ) {
        return false;
      }

      canvas.width = Math.max(1, Math.floor(cssWidth * effectiveRatio));
      canvas.height = Math.max(1, Math.floor(cssHeight * effectiveRatio));
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.style.transformOrigin = "left top";
      canvas.style.transform = compositorScaleX === 1 ? "none" : `scaleX(${roundMetric(compositorScaleX, 4)})`;
      gl.viewport(0, 0, canvas.width, canvas.height);
      viewportRef.current = { width, height, cssWidth, cssHeight, ratio, renderScale, effectiveRatio, compositorScaleX };
      metricsRef.current.resizeCommitCount += 1;
      return true;
    }

    function requestResize() {
      resizeRequestedRef.current = true;
    }

    try {
      program = createProgram(gl);
      const positionLocation = gl.getAttribLocation(program, "a_position");
      const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
      const timeLocation = gl.getUniformLocation(program, "u_time");
      const lowLocation = gl.getUniformLocation(program, "u_low");
      const midLocation = gl.getUniformLocation(program, "u_mid");
      const highLocation = gl.getUniformLocation(program, "u_high");
      const transitionLocation = gl.getUniformLocation(program, "u_transition");
      const minimalLocation = gl.getUniformLocation(program, "u_minimal");
      const accentLocation = gl.getUniformLocation(program, "u_accent");
      const glowLocation = gl.getUniformLocation(program, "u_glow");

      positionBuffer = gl.createBuffer();
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      function render(nowMs) {
        if (disposed) {
          return;
        }

        if (resizeRequestedRef.current) {
          resizeRequestedRef.current = false;
          resize({ preserveFrame: true });
        }

        const budget = getWebglPerformanceRenderBudget(renderBudgetRef.current ?? {});
        const frameIntervalMs = Math.max(16, Number(budget.frameIntervalMs ?? 16));
        if (lastRenderedAt && nowMs - lastRenderedAt < frameIntervalMs) {
          metricsRef.current.skippedRenderCount += 1;
          frameId = window.requestAnimationFrame(render);
          return;
        }

        metricsRef.current.lastFrameIntervalMs = roundMetric(lastRenderedAt ? nowMs - lastRenderedAt : frameIntervalMs, 2);
        lastRenderedAt = nowMs;

        try {
          const liveTheme = themeRef.current;
          const liveMetrics = audioMetricsRef.current;
          const livePhase = appPhaseRef.current;
          const previousMetrics = smoothedMetricsRef.current;
          const smoothing = livePhase === "transitioning" ? 0.08 : 0.16;
          const smoothedMetrics = {
            lowEnergy: previousMetrics.lowEnergy + (liveMetrics.lowEnergy - previousMetrics.lowEnergy) * smoothing,
            midEnergy: previousMetrics.midEnergy + (liveMetrics.midEnergy - previousMetrics.midEnergy) * smoothing,
            highEnergy: previousMetrics.highEnergy + (liveMetrics.highEnergy - previousMetrics.highEnergy) * smoothing,
          };
          smoothedMetricsRef.current = smoothedMetrics;

          const sceneMode = budget.flowSceneMode ?? "animated";
          const desiredLayerCount = livePhase === "transitioning" ? 1 : currentStateRef.current === "flow" ? 2 : 1;
          const layerCount = Math.min(desiredLayerCount, Math.max(1, Number(budget.maxWaveLayers ?? 1)));
          const lowPowerBudget =
            Number(budget.pixelRatioCap ?? 1) <= 0.85 ||
            Number(budget.renderScale ?? 1) <= 0.4 ||
            Number(budget.particleMultiplier ?? 1) <= 0.12 ||
            Number(budget.maxWaveLayers ?? 1) <= 1;
          const isMinimalScene = sceneMode === "minimal";
          const accent = hexToRgb(liveTheme.accent, { r: 0.58, g: 0.71, b: 0.96 });
          const glow = hexToRgb(liveTheme.glow, { r: 0.82, g: 0.54, b: 0.93 });

          gl.useProgram(program);
          gl.bindVertexArray(vao);
          gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
          gl.uniform1f(timeLocation, nowMs / 1000);
          gl.uniform1f(lowLocation, clamp(smoothedMetrics.lowEnergy, 0, 1));
          gl.uniform1f(midLocation, clamp(smoothedMetrics.midEnergy, 0, 1));
          gl.uniform1f(highLocation, clamp(smoothedMetrics.highEnergy, 0, 1));
          gl.uniform1f(transitionLocation, livePhase === "transitioning" ? 1 : 0);
          gl.uniform1f(minimalLocation, isMinimalScene ? 1 : lowPowerBudget ? 0.55 : 0);
          gl.uniform3f(accentLocation, accent.r, accent.g, accent.b);
          gl.uniform3f(glowLocation, glow.r, glow.g, glow.b);
          gl.drawArrays(gl.TRIANGLES, 0, 6);

          if (livePhase === "transitioning") {
            metricsRef.current.transitionFrameBudgetHits += 1;
          }

          const rendererMetadataSnapshot = rendererMetadataRef.current ?? {};
          setFlowRenderDebugSnapshot({
            ...metricsRef.current,
            width: viewportRef.current.width,
            height: viewportRef.current.height,
            cssWidth: viewportRef.current.cssWidth,
            cssHeight: viewportRef.current.cssHeight,
            ratio: viewportRef.current.ratio,
            renderScale: viewportRef.current.renderScale,
            webglRenderScale: viewportRef.current.renderScale,
            effectiveRatio: viewportRef.current.effectiveRatio,
            compositorScaleX: viewportRef.current.compositorScaleX,
            desiredLayerCount,
            layerCount,
            flowDiagnosticMode: "off",
            staticSceneActive: false,
            lowPowerBudget,
            flowSceneMode: sceneMode,
            phase: livePhase,
            rendererType: "webgl",
            requestedRenderer: rendererMetadataSnapshot.requestedRenderer ?? "webgl",
            rendererFallbackCount: rendererMetadataSnapshot.rendererFallbackCount ?? 0,
            glInitErrorCount: rendererMetadataSnapshot.glInitErrorCount ?? 0,
            glContextLostCount: rendererMetadataSnapshot.glContextLostCount ?? 0,
            rendererFallbackReason: rendererMetadataSnapshot.rendererFallbackReason ?? null,
            chromiumExperiment: rendererMetadataSnapshot.chromiumExperiment ?? "baseline",
          });
        } catch {
          onFallback?.("webgl_render_error", { rendererFallbackDelta: 1 });
          return;
        }

        frameId = window.requestAnimationFrame(render);
      }

      resize();
      frameId = window.requestAnimationFrame(render);
      window.addEventListener("resize", requestResize);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frameId);
        window.removeEventListener("resize", requestResize);
        canvas.removeEventListener("webglcontextlost", handleContextLost, false);
        if (vao) {
          gl.deleteVertexArray(vao);
        }
        if (positionBuffer) {
          gl.deleteBuffer(positionBuffer);
        }
        if (program) {
          gl.deleteProgram(program);
        }
        delete window.__TIKPAL_CANVAS_DEBUG__;
      };
    } catch {
      canvas.removeEventListener("webglcontextlost", handleContextLost, false);
      onFallback?.("webgl_init_error", { glInitErrorDelta: 1, rendererFallbackDelta: 1 });
      return undefined;
    }
  }, [onFallback]);

  return <canvas ref={canvasRef} className="visual-canvas" aria-hidden="true" />;
}
