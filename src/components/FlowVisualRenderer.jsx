import { useCallback, useEffect, useState } from "react";
import { FlowWebGLCanvas } from "./FlowWebGLCanvas";
import { VisualEngineCanvas } from "./VisualEngineCanvas";

function createRendererState() {
  return {
    fallbackActive: false,
    rendererFallbackCount: 0,
    glInitErrorCount: 0,
    glContextLostCount: 0,
    rendererFallbackReason: null,
  };
}

export function FlowVisualRenderer({
  currentState,
  theme,
  audioMetrics,
  appPhase,
  renderBudget,
  flowDiagnosticMode = "off",
  rendererPreference = "canvas",
  chromiumExperiment = "baseline",
}) {
  const [rendererState, setRendererState] = useState(createRendererState);

  useEffect(() => {
    setRendererState((current) => {
      if (rendererPreference === "canvas") {
        return {
          ...current,
          fallbackActive: false,
        };
      }

      return createRendererState();
    });
  }, [rendererPreference]);

  const handleFallback = useCallback((reason, deltas = {}) => {
    setRendererState((current) => ({
      fallbackActive: true,
      rendererFallbackCount: current.rendererFallbackCount + Number(deltas.rendererFallbackDelta ?? 1),
      glInitErrorCount: current.glInitErrorCount + Number(deltas.glInitErrorDelta ?? 0),
      glContextLostCount: current.glContextLostCount + Number(deltas.glContextLostDelta ?? 0),
      rendererFallbackReason: reason,
    }));
  }, []);

  const rendererMetadata = {
    requestedRenderer: rendererPreference,
    rendererFallbackCount: rendererState.rendererFallbackCount,
    glInitErrorCount: rendererState.glInitErrorCount,
    glContextLostCount: rendererState.glContextLostCount,
    rendererFallbackReason: rendererState.rendererFallbackReason,
    chromiumExperiment,
  };

  const shouldTryWebgl = flowDiagnosticMode !== "static" && (rendererPreference === "webgl" || rendererPreference === "auto");
  if (shouldTryWebgl && !rendererState.fallbackActive) {
    return (
      <FlowWebGLCanvas
        currentState={currentState}
        theme={theme}
        audioMetrics={audioMetrics}
        appPhase={appPhase}
        renderBudget={renderBudget}
        rendererMetadata={rendererMetadata}
        onFallback={handleFallback}
      />
    );
  }

  return (
    <VisualEngineCanvas
      currentState={currentState}
      theme={theme}
      audioMetrics={audioMetrics}
      appPhase={appPhase}
      renderBudget={renderBudget}
      flowDiagnosticMode={flowDiagnosticMode}
      rendererMetadata={rendererMetadata}
    />
  );
}
