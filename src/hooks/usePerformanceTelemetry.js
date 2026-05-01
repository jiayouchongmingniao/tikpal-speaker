import { useEffect, useRef } from "react";
import { summarizeFrameWindow } from "../viewmodels/performance";

const DEFAULT_SAMPLE_INTERVAL_MS = 5000;

export function usePerformanceTelemetry({
  enabled = true,
  activeMode = "overview",
  reportPerformance,
  sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS,
} = {}) {
  const reportRef = useRef(reportPerformance);
  const activeModeRef = useRef(activeMode);

  useEffect(() => {
    reportRef.current = reportPerformance;
    activeModeRef.current = activeMode;
  }, [activeMode, reportPerformance]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.requestAnimationFrame) {
      return undefined;
    }

    let frameId = 0;
    let disposed = false;
    let frames = 0;
    let windowStartedAt = performance.now();
    let previousFrameAt = windowStartedAt;
    let maxFrameDeltaMs = 0;

    function resetWindow(now) {
      frames = 0;
      windowStartedAt = now;
      previousFrameAt = now;
      maxFrameDeltaMs = 0;
    }

    function tick(now) {
      if (disposed) {
        return;
      }

      frames += 1;
      const frameDelta = now - previousFrameAt;
      previousFrameAt = now;
      maxFrameDeltaMs = Math.max(maxFrameDeltaMs, frameDelta);

      const elapsedMs = now - windowStartedAt;
      if (elapsedMs >= sampleIntervalMs) {
        const diagnostics =
          window.__TIKPAL_CANVAS_DEBUG__ && typeof window.__TIKPAL_CANVAS_DEBUG__ === "object"
            ? {
                skippedRenderCount: Number(window.__TIKPAL_CANVAS_DEBUG__.skippedRenderCount ?? 0),
                resizeCommitCount: Number(window.__TIKPAL_CANVAS_DEBUG__.resizeCommitCount ?? 0),
                transitionFrameBudgetHits: Number(window.__TIKPAL_CANVAS_DEBUG__.transitionFrameBudgetHits ?? 0),
                lastFrameIntervalMs: Number(window.__TIKPAL_CANVAS_DEBUG__.lastFrameIntervalMs ?? 0),
                width: Number(window.__TIKPAL_CANVAS_DEBUG__.width ?? 0),
                height: Number(window.__TIKPAL_CANVAS_DEBUG__.height ?? 0),
                cssWidth: Number(window.__TIKPAL_CANVAS_DEBUG__.cssWidth ?? 0),
                cssHeight: Number(window.__TIKPAL_CANVAS_DEBUG__.cssHeight ?? 0),
                ratio: Number(window.__TIKPAL_CANVAS_DEBUG__.ratio ?? 0),
                renderScale: Number(window.__TIKPAL_CANVAS_DEBUG__.renderScale ?? 0),
                webglRenderScale: Number(window.__TIKPAL_CANVAS_DEBUG__.webglRenderScale ?? 0),
                effectiveRatio: Number(window.__TIKPAL_CANVAS_DEBUG__.effectiveRatio ?? 0),
                compositorScaleX: Number(window.__TIKPAL_CANVAS_DEBUG__.compositorScaleX ?? 1),
                desiredLayerCount: Number(window.__TIKPAL_CANVAS_DEBUG__.desiredLayerCount ?? 0),
                layerCount: Number(window.__TIKPAL_CANVAS_DEBUG__.layerCount ?? 0),
                flowDiagnosticMode: window.__TIKPAL_CANVAS_DEBUG__.flowDiagnosticMode === "static" ? "static" : "off",
                staticSceneActive: Boolean(window.__TIKPAL_CANVAS_DEBUG__.staticSceneActive),
                lowPowerBudget: Boolean(window.__TIKPAL_CANVAS_DEBUG__.lowPowerBudget),
                flowSceneMode:
                  window.__TIKPAL_CANVAS_DEBUG__.flowSceneMode === "static"
                    ? "static"
                    : window.__TIKPAL_CANVAS_DEBUG__.flowSceneMode === "minimal"
                      ? "minimal"
                      : "animated",
                phase: String(window.__TIKPAL_CANVAS_DEBUG__.phase ?? ""),
                rendererType: String(window.__TIKPAL_CANVAS_DEBUG__.rendererType ?? "image"),
                requestedRenderer: String(window.__TIKPAL_CANVAS_DEBUG__.requestedRenderer ?? "image"),
                rendererFallbackCount: Number(window.__TIKPAL_CANVAS_DEBUG__.rendererFallbackCount ?? 0),
                glInitErrorCount: Number(window.__TIKPAL_CANVAS_DEBUG__.glInitErrorCount ?? 0),
                glContextLostCount: Number(window.__TIKPAL_CANVAS_DEBUG__.glContextLostCount ?? 0),
                rendererFallbackReason:
                  window.__TIKPAL_CANVAS_DEBUG__.rendererFallbackReason === null ||
                  window.__TIKPAL_CANVAS_DEBUG__.rendererFallbackReason === undefined
                    ? null
                    : String(window.__TIKPAL_CANVAS_DEBUG__.rendererFallbackReason),
                chromiumExperiment: String(window.__TIKPAL_CANVAS_DEBUG__.chromiumExperiment ?? "baseline"),
              }
            : null;
        const summary = summarizeFrameWindow({
          frames,
          elapsedMs,
          maxFrameDeltaMs,
          memory: performance.memory,
          diagnostics,
        });

        reportRef.current?.({
          ...summary,
          activeMode: activeModeRef.current,
          flowDiagnosticMode: diagnostics?.flowDiagnosticMode ?? "off",
          rendererType: diagnostics?.rendererType ?? "image",
          requestedRenderer: diagnostics?.requestedRenderer ?? "image",
          rendererFallbackCount: diagnostics?.rendererFallbackCount ?? 0,
          glInitErrorCount: diagnostics?.glInitErrorCount ?? 0,
          glContextLostCount: diagnostics?.glContextLostCount ?? 0,
          rendererFallbackReason: diagnostics?.rendererFallbackReason ?? null,
          chromiumExperiment: diagnostics?.chromiumExperiment ?? "baseline",
        });
        resetWindow(now);
      }

      frameId = window.requestAnimationFrame(tick);
    }

    frameId = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [enabled, sampleIntervalMs]);
}
