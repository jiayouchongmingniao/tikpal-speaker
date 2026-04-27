import { useEffect, useMemo, useRef, useState } from "react";
import { VisualEngineCanvas } from "./VisualEngineCanvas";
import { FlowWebGLCanvas } from "./FlowWebGLCanvas";
import { emitFlowRendererStats, normalizeFlowRenderer } from "../viewmodels/flowRenderer";

function canUseWebGL2() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

export function FlowVisualRenderer({
  preferredRenderer = "canvas",
  currentState,
  theme,
  audioMetrics,
  appPhase,
  renderBudget,
}) {
  const requested = normalizeFlowRenderer(preferredRenderer);
  const [renderer, setRenderer] = useState(() => (requested === "gl" && canUseWebGL2() ? "gl" : "canvas"));
  const statsRef = useRef({
    rendererType: requested,
    rendererFallbackCount: 0,
    glInitErrorCount: 0,
    glContextLostCount: 0,
    rendererFallbackReason: null,
  });

  useEffect(() => {
    const nextRenderer = requested === "gl" && canUseWebGL2() ? "gl" : "canvas";
    setRenderer(nextRenderer);
    statsRef.current = {
      ...statsRef.current,
      rendererType: nextRenderer,
      rendererFallbackReason: null,
    };
    emitFlowRendererStats(statsRef.current);
  }, [requested]);

  const rendererProps = useMemo(
    () => ({
      currentState,
      theme,
      audioMetrics,
      appPhase,
      renderBudget,
    }),
    [appPhase, audioMetrics, currentState, renderBudget, theme],
  );

  function mergeStats(patch = {}) {
    statsRef.current = {
      ...statsRef.current,
      ...(patch ?? {}),
    };
    emitFlowRendererStats(statsRef.current);
  }

  function fallbackToCanvas(reason = "gl_fallback") {
    setRenderer("canvas");
    mergeStats({
      rendererType: "canvas",
      rendererFallbackCount: Number(statsRef.current.rendererFallbackCount ?? 0) + 1,
      rendererFallbackReason: `renderer_fallback:${reason}`,
    });
  }

  if (renderer === "gl") {
    return (
      <FlowWebGLCanvas
        {...rendererProps}
        onReady={() =>
          mergeStats({
            rendererType: "gl",
            rendererFallbackReason: null,
          })
        }
        onInitError={(count) =>
          mergeStats({
            glInitErrorCount: count,
          })
        }
        onContextLost={(count) =>
          mergeStats({
            glContextLostCount: count,
          })
        }
        onFallback={fallbackToCanvas}
      />
    );
  }

  return <VisualEngineCanvas {...rendererProps} />;
}
