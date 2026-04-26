export const CREATIVE_CARE_MOODS = ["clear", "scattered", "stuck", "tired", "calm", "energized"];
export const CREATIVE_CARE_MODES = ["focus", "flow", "unwind", "sleep"];

export const FLOW_CARE_LABELS = {
  focus: {
    label: "Focus Care",
    subtitle: "Steady the next thought",
  },
  flow: {
    label: "Deep Flow",
    subtitle: "Follow the useful spark",
  },
  relax: {
    label: "Unwind",
    subtitle: "Let the edges soften",
  },
  sleep: {
    label: "Sleep Drift",
    subtitle: "Dim the room inside",
  },
};

const DEFAULT_CREATIVE_CARE = {
  latestTranscript: "",
  moodLabel: "clear",
  moodIntensity: 0.45,
  inspirationSummary: "Ready for a fresh creative session.",
  suggestedFlowState: "flow",
  currentCareMode: "flow",
  insightSentence: "Start with one clear thought, then let the session find its shape.",
  updatedAt: null,
  metadata: {
    source: "system",
    captureLength: 0,
  },
};

export function normalizeCreativeCare(creativeCare) {
  const moodLabel = CREATIVE_CARE_MOODS.includes(creativeCare?.moodLabel) ? creativeCare.moodLabel : DEFAULT_CREATIVE_CARE.moodLabel;
  const currentCareMode = CREATIVE_CARE_MODES.includes(creativeCare?.currentCareMode)
    ? creativeCare.currentCareMode
    : DEFAULT_CREATIVE_CARE.currentCareMode;
  const suggestedFlowState = ["focus", "flow", "relax", "sleep"].includes(creativeCare?.suggestedFlowState)
    ? creativeCare.suggestedFlowState
    : DEFAULT_CREATIVE_CARE.suggestedFlowState;

  return {
    ...DEFAULT_CREATIVE_CARE,
    ...(creativeCare ?? {}),
    moodLabel,
    currentCareMode,
    suggestedFlowState,
    moodIntensity: Math.min(1, Math.max(0, Number(creativeCare?.moodIntensity ?? DEFAULT_CREATIVE_CARE.moodIntensity))),
    metadata: {
      ...DEFAULT_CREATIVE_CARE.metadata,
      ...(creativeCare?.metadata ?? {}),
    },
  };
}

export function getCreativeCareViewModel(state) {
  const care = normalizeCreativeCare(state?.creativeCare);
  const flowLabel = FLOW_CARE_LABELS[care.suggestedFlowState] ?? FLOW_CARE_LABELS.flow;
  const moodText = care.moodLabel.charAt(0).toUpperCase() + care.moodLabel.slice(1);
  const careText = care.currentCareMode === "unwind" ? "Unwind" : care.currentCareMode.charAt(0).toUpperCase() + care.currentCareMode.slice(1);
  const soundscape =
    care.currentCareMode === "sleep"
      ? "Low, slow ambient support"
      : care.currentCareMode === "unwind"
        ? "Warm ambient support"
        : care.currentCareMode === "focus"
          ? "Steady focus bed"
          : "Open creative soundscape";

  return {
    ...care,
    moodText,
    careText,
    flowLabel: flowLabel.label,
    flowSubtitle: flowLabel.subtitle,
    soundscape,
    hasVoiceContext: Boolean(care.latestTranscript || care.updatedAt),
    intention: care.inspirationSummary || DEFAULT_CREATIVE_CARE.inspirationSummary,
    nextGentleAction:
      care.currentCareMode === "sleep"
        ? "Let the session settle and lower the volume."
        : care.currentCareMode === "unwind"
          ? "Take one slower pass before choosing the next move."
          : care.currentCareMode === "focus"
            ? "Choose the smallest useful next step."
            : "Keep the idea moving while it still has warmth.",
  };
}

export function getFlowCareCopy(flowState) {
  return FLOW_CARE_LABELS[flowState] ?? FLOW_CARE_LABELS.flow;
}
