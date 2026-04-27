export const FLOW_RENDERER_STATS_EVENT = "tikpal-flow-renderer-stats";

const DEFAULT_FLOW_RENDERER_STATS = {
  rendererType: "canvas",
  rendererFallbackCount: 0,
  glInitErrorCount: 0,
  glContextLostCount: 0,
  rendererFallbackReason: null,
};

function readRendererFromWindow() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.FLOW_RENDERER ?? window.__FLOW_RENDERER__ ?? window.__TIKPAL_FLOW_RENDERER__ ?? null;
}

export function normalizeFlowRenderer(renderer = "canvas") {
  return renderer === "gl" ? "gl" : "canvas";
}

export function getPreferredFlowRenderer() {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("FLOW_RENDERER") ?? params.get("flowRenderer");
    if (fromQuery) {
      return normalizeFlowRenderer(fromQuery);
    }
  }

  const fromWindow = readRendererFromWindow();
  if (fromWindow) {
    return normalizeFlowRenderer(fromWindow);
  }

  return normalizeFlowRenderer(import.meta.env.VITE_FLOW_RENDERER ?? import.meta.env.FLOW_RENDERER ?? "canvas");
}

export function readFlowRendererStats() {
  if (typeof window === "undefined") {
    return { ...DEFAULT_FLOW_RENDERER_STATS };
  }

  return {
    ...DEFAULT_FLOW_RENDERER_STATS,
    ...(window.__TIKPAL_FLOW_RENDERER_STATS__ ?? {}),
  };
}

export function emitFlowRendererStats(patch = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const next = {
    ...readFlowRendererStats(),
    ...(patch ?? {}),
  };
  window.__TIKPAL_FLOW_RENDERER_STATS__ = next;
  window.dispatchEvent(
    new CustomEvent(FLOW_RENDERER_STATS_EVENT, {
      detail: next,
    }),
  );
}
