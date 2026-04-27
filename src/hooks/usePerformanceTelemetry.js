import { useEffect, useRef } from "react";
import { FLOW_RENDERER_STATS_EVENT, readFlowRendererStats } from "../viewmodels/flowRenderer";
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
  const flowRendererStatsRef = useRef(readFlowRendererStats());

  useEffect(() => {
    reportRef.current = reportPerformance;
    activeModeRef.current = activeMode;
  }, [activeMode, reportPerformance]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function onRendererStats(event) {
      flowRendererStatsRef.current = {
        ...flowRendererStatsRef.current,
        ...(event?.detail ?? {}),
      };
    }

    window.addEventListener(FLOW_RENDERER_STATS_EVENT, onRendererStats);
    return () => window.removeEventListener(FLOW_RENDERER_STATS_EVENT, onRendererStats);
  }, []);

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
        const summary = summarizeFrameWindow({
          frames,
          elapsedMs,
          maxFrameDeltaMs,
          memory: performance.memory,
        });

        reportRef.current?.({
          ...summary,
          activeMode: activeModeRef.current,
          rendererType: flowRendererStatsRef.current.rendererType ?? "canvas",
          rendererFallbackCount: Number(flowRendererStatsRef.current.rendererFallbackCount ?? 0),
          glInitErrorCount: Number(flowRendererStatsRef.current.glInitErrorCount ?? 0),
          glContextLostCount: Number(flowRendererStatsRef.current.glContextLostCount ?? 0),
          rendererFallbackReason: flowRendererStatsRef.current.rendererFallbackReason ?? null,
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
