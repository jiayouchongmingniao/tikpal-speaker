export const FLOW_RENDERER_OPTIONS = ["image", "canvas", "auto", "webgl"];

export function normalizeFlowRenderer(value = "image") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "image";
  if (normalized === "gl") {
    return "webgl";
  }
  return FLOW_RENDERER_OPTIONS.includes(normalized) ? normalized : "image";
}

export function normalizeChromiumExperiment(value = "baseline") {
  if (typeof value !== "string") {
    return "baseline";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "baseline";
  }

  return normalized.replace(/[^a-z0-9._-]+/g, "-");
}

export function getFlowRendererRuntimeConfig(locationLike = globalThis?.window?.location) {
  const search = locationLike?.search ?? "";
  const params = new URLSearchParams(search);
  const defaultRenderer = normalizeFlowRenderer(import.meta.env?.VITE_FLOW_RENDERER ?? "image");
  return {
    flowRenderer: normalizeFlowRenderer(params.get("flowRenderer") ?? defaultRenderer),
    chromiumExperiment: normalizeChromiumExperiment(params.get("chromiumExperiment") ?? "baseline"),
  };
}
