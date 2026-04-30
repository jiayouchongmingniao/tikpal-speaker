import { FLOW_SCENE_ASSETS } from "./flowSceneAssets.generated.js";

const FLOW_SCENE_STATES = ["focus", "flow", "relax", "sleep"];

function escapeSvg(value) {
  return encodeURIComponent(value).replace(/%20/g, " ");
}

function createSceneArtworkDataUri({
  background,
  accent,
  glow,
  contour,
  pattern = "waves",
}) {
  const motif =
    pattern === "grid"
      ? `
  <path d="M0 170 H2560 M0 360 H2560 M0 550 H2560" stroke="${contour}" stroke-width="2" stroke-opacity="0.24"/>
  <path d="M480 0 V720 M1280 0 V720 M2080 0 V720" stroke="${contour}" stroke-width="2" stroke-opacity="0.18"/>
`
      : pattern === "mist"
        ? `
  <path d="M-120 474 C180 396 356 558 648 480 C938 402 1100 598 1428 512 C1710 438 1932 576 2242 492 C2376 456 2482 468 2680 438" fill="none" stroke="${contour}" stroke-width="24" stroke-linecap="round" stroke-opacity="0.34"/>
  <path d="M-80 568 C178 498 396 632 682 556 C996 472 1214 662 1534 588 C1792 528 2044 650 2332 570 C2450 536 2564 552 2700 522" fill="none" stroke="${glow}" stroke-width="18" stroke-linecap="round" stroke-opacity="0.24"/>
`
        : pattern === "ripple"
          ? `
  <path d="M-40 388 C208 286 444 490 712 382 C944 290 1214 484 1490 384 C1760 286 1984 480 2270 382 C2396 338 2496 340 2600 320" fill="none" stroke="${contour}" stroke-width="16" stroke-linecap="round" stroke-opacity="0.3"/>
  <path d="M-40 462 C218 360 478 548 768 452 C1008 374 1260 552 1524 458 C1758 376 2016 548 2280 454 C2408 410 2514 414 2620 394" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" stroke-opacity="0.22"/>
`
          : `
  <path d="M-40 428 C198 334 400 532 664 436 C914 344 1120 528 1398 428 C1668 332 1918 538 2192 436 C2332 382 2444 394 2600 358" fill="none" stroke="${accent}" stroke-width="16" stroke-linecap="round" stroke-opacity="0.28"/>
  <path d="M-40 510 C224 416 432 608 706 516 C960 430 1182 622 1452 526 C1704 438 1950 624 2218 534 C2350 486 2466 498 2608 466" fill="none" stroke="${contour}" stroke-width="12" stroke-linecap="round" stroke-opacity="0.24"/>
`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="720" viewBox="0 0 2560 720" fill="none">
  <defs>
    <linearGradient id="bg" x1="160" y1="120" x2="2400" y2="640" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${background[0]}"/>
      <stop offset="52%" stop-color="${background[1]}"/>
      <stop offset="100%" stop-color="${background[2]}"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1810 206) rotate(90) scale(284 520)">
      <stop offset="0%" stop-color="${glow}" stop-opacity="0.86"/>
      <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(560 552) rotate(90) scale(256 460)">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="2560" height="720" fill="url(#bg)"/>
  <rect width="2560" height="720" fill="url(#glowA)"/>
  <rect width="2560" height="720" fill="url(#glowB)"/>
  <circle cx="2108" cy="148" r="132" fill="${glow}" fill-opacity="0.14"/>
  <circle cx="664" cy="560" r="188" fill="${accent}" fill-opacity="0.11"/>
  ${motif}
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${escapeSvg(svg)}`;
}

const SCENE_BLUEPRINTS = {
  focus: [
    {
      slug: "studio-lofi",
      label: "Studio Lofi",
      subtitle: "Steady beats for the first useful move.",
      audioLabel: "Studio Lofi",
      audioArtist: "Tikpal Focus Care",
      audioSource: "Built-in Lofi Pack",
      background: ["#08131E", "#1B3552", "#4765A0"],
      accent: "#78A8FF",
      glow: "#B7D7FF",
      contour: "#9DBDFF",
      pattern: "grid",
    },
    {
      slug: "paper-lantern",
      label: "Paper Lantern",
      subtitle: "Warm structure for careful desk work.",
      audioLabel: "Paper Lantern Lofi",
      audioArtist: "Tikpal Focus Care",
      audioSource: "Built-in Lofi Pack",
      background: ["#1A1112", "#58373B", "#B57B6D"],
      accent: "#FFB28A",
      glow: "#FFD7A8",
      contour: "#FFCAA8",
      pattern: "waves",
    },
    {
      slug: "quiet-library",
      label: "Quiet Library",
      subtitle: "A slower rhythm for concentrated reading.",
      audioLabel: "Quiet Library Lofi",
      audioArtist: "Tikpal Focus Care",
      audioSource: "Built-in Lofi Pack",
      background: ["#0C1312", "#24403C", "#4F7B72"],
      accent: "#91E0C7",
      glow: "#C7FFF2",
      contour: "#9DEACD",
      pattern: "mist",
    },
    {
      slug: "signal-desks",
      label: "Signal Desks",
      subtitle: "Trim the noise and stay with the outline.",
      audioLabel: "Signal Desks Lofi",
      audioArtist: "Tikpal Focus Care",
      audioSource: "Built-in Lofi Pack",
      background: ["#0F1524", "#26345C", "#6A7EC4"],
      accent: "#A7BAFF",
      glow: "#D6E0FF",
      contour: "#B9CAFF",
      pattern: "grid",
    },
    {
      slug: "cinder-notes",
      label: "Cinder Notes",
      subtitle: "Soft percussion for patient drafting.",
      audioLabel: "Cinder Notes Lofi",
      audioArtist: "Tikpal Focus Care",
      audioSource: "Built-in Lofi Pack",
      background: ["#160F18", "#4A2854", "#9F5B84"],
      accent: "#F3A7D0",
      glow: "#FFD6EE",
      contour: "#EDBADB",
      pattern: "ripple",
    },
  ],
  flow: [
    {
      slug: "white-noise-veil",
      label: "White Noise Veil",
      subtitle: "A dense veil that keeps the work tunnel open.",
      audioLabel: "White Noise Veil",
      audioArtist: "Tikpal Deep Flow",
      audioSource: "Built-in White Noise Pack",
      background: ["#070B14", "#1E2B54", "#5D5BD1"],
      accent: "#9DA9FF",
      glow: "#CCD3FF",
      contour: "#B2BCFF",
      pattern: "waves",
    },
    {
      slug: "ocean-hiss",
      label: "Ocean Hiss",
      subtitle: "A marine hush with long, unbroken momentum.",
      audioLabel: "Ocean Hiss",
      audioArtist: "Tikpal Deep Flow",
      audioSource: "Built-in White Noise Pack",
      background: ["#07131D", "#11405C", "#1A7A9A"],
      accent: "#7FE7FF",
      glow: "#B8F7FF",
      contour: "#89E7FB",
      pattern: "ripple",
    },
    {
      slug: "air-column",
      label: "Air Column",
      subtitle: "Dry, even airflow for high-focus sessions.",
      audioLabel: "Air Column",
      audioArtist: "Tikpal Deep Flow",
      audioSource: "Built-in White Noise Pack",
      background: ["#0A0E18", "#30314E", "#7D7EAB"],
      accent: "#D0D2F7",
      glow: "#F2F3FF",
      contour: "#D8D8F7",
      pattern: "grid",
    },
    {
      slug: "violet-mach",
      label: "Violet Mach",
      subtitle: "Layered flow for long-form creative runs.",
      audioLabel: "Violet Mach",
      audioArtist: "Tikpal Deep Flow",
      audioSource: "Built-in White Noise Pack",
      background: ["#0E1020", "#392C6D", "#8A4D88"],
      accent: "#D8B0FF",
      glow: "#FFC0E8",
      contour: "#D5B2FF",
      pattern: "waves",
    },
    {
      slug: "night-fan",
      label: "Night Fan",
      subtitle: "Low fan texture and a clean visual horizon.",
      audioLabel: "Night Fan",
      audioArtist: "Tikpal Deep Flow",
      audioSource: "Built-in White Noise Pack",
      background: ["#05070D", "#172230", "#364A63"],
      accent: "#A3C7E8",
      glow: "#DDEEFF",
      contour: "#A9CBE5",
      pattern: "mist",
    },
  ],
  relax: [
    {
      slug: "ember-mist",
      label: "Ember Mist",
      subtitle: "Gentle warmth for coming down from intensity.",
      audioLabel: "Ember Mist",
      audioArtist: "Tikpal Unwind",
      audioSource: "Built-in Ambient Pack",
      background: ["#1B110F", "#5D3227", "#C87456"],
      accent: "#FFC29A",
      glow: "#FFD9C0",
      contour: "#F0C39E",
      pattern: "mist",
    },
    {
      slug: "cedar-cloud",
      label: "Cedar Cloud",
      subtitle: "A woody dusk with room to breathe.",
      audioLabel: "Cedar Cloud",
      audioArtist: "Tikpal Unwind",
      audioSource: "Built-in Ambient Pack",
      background: ["#15110D", "#4B3929", "#8C6B4F"],
      accent: "#E5CAA9",
      glow: "#F7E4C7",
      contour: "#D9C0A4",
      pattern: "ripple",
    },
    {
      slug: "pearl-rain",
      label: "Pearl Rain",
      subtitle: "Light rain textures for looser shoulders.",
      audioLabel: "Pearl Rain",
      audioArtist: "Tikpal Unwind",
      audioSource: "Built-in Ambient Pack",
      background: ["#0E121A", "#2F4961", "#7E91A8"],
      accent: "#D5E5F8",
      glow: "#EEF7FF",
      contour: "#D4E0EF",
      pattern: "mist",
    },
    {
      slug: "orchid-air",
      label: "Orchid Air",
      subtitle: "Soft violet motion for a slower pulse.",
      audioLabel: "Orchid Air",
      audioArtist: "Tikpal Unwind",
      audioSource: "Built-in Ambient Pack",
      background: ["#130E1B", "#47345F", "#866BAA"],
      accent: "#E5C7FF",
      glow: "#F6E0FF",
      contour: "#DDBAFF",
      pattern: "waves",
    },
    {
      slug: "amber-room",
      label: "Amber Room",
      subtitle: "Close the loop without dropping the thread.",
      audioLabel: "Amber Room",
      audioArtist: "Tikpal Unwind",
      audioSource: "Built-in Ambient Pack",
      background: ["#17110C", "#664124", "#C58A4A"],
      accent: "#FFD4A2",
      glow: "#FFE8C4",
      contour: "#F0C58E",
      pattern: "grid",
    },
  ],
  sleep: [
    {
      slug: "power-nap",
      label: "Power Nap",
      subtitle: "午间小憩 · a compact drift for midday recovery.",
      audioLabel: "Power Nap",
      audioArtist: "Tikpal Sleep Drift",
      audioSource: "Built-in Sleep Pack",
      background: ["#03050A", "#17243A", "#37506E"],
      accent: "#9CB9DD",
      glow: "#D7E6F7",
      contour: "#A8BED8",
      pattern: "ripple",
      ritualLabelZh: "午间小憩",
    },
    {
      slug: "quick-reset",
      label: "Quick Reset",
      subtitle: "临时补眠 · a short cocoon before the next stretch.",
      audioLabel: "Quick Reset",
      audioArtist: "Tikpal Sleep Drift",
      audioSource: "Built-in Sleep Pack",
      background: ["#04060E", "#1F1E38", "#48507C"],
      accent: "#B3C0F1",
      glow: "#DEE5FF",
      contour: "#B9C4E8",
      pattern: "mist",
      ritualLabelZh: "临时补眠",
    },
    {
      slug: "between-meetings",
      label: "Between Meetings",
      subtitle: "会议间歇休整 · rinse the mind between obligations.",
      audioLabel: "Between Meetings",
      audioArtist: "Tikpal Sleep Drift",
      audioSource: "Built-in Sleep Pack",
      background: ["#04070D", "#0F2733", "#285867"],
      accent: "#A7D8E5",
      glow: "#D8F6FF",
      contour: "#A7D2DD",
      pattern: "waves",
      ritualLabelZh: "会议间歇休整",
    },
    {
      slug: "eyes-closed",
      label: "Eyes Closed",
      subtitle: "闭目养神 · low-motion rest without full sleep inertia.",
      audioLabel: "Eyes Closed",
      audioArtist: "Tikpal Sleep Drift",
      audioSource: "Built-in Sleep Pack",
      background: ["#050507", "#15161E", "#34384C"],
      accent: "#BFC7D8",
      glow: "#EDF0F7",
      contour: "#BCC4D5",
      pattern: "mist",
      ritualLabelZh: "闭目养神",
    },
    {
      slug: "moon-hush",
      label: "Moon Hush",
      subtitle: "A neutral overnight drift with almost no edges.",
      audioLabel: "Moon Hush",
      audioArtist: "Tikpal Sleep Drift",
      audioSource: "Built-in Sleep Pack",
      background: ["#020305", "#050812", "#0B1020"],
      accent: "#8793B6",
      glow: "#C4D2E7",
      contour: "#8C97B3",
      pattern: "ripple",
      ritualLabelZh: "静夜缓眠",
    },
  ],
};

function materializeScenes() {
  return Object.freeze(
    Object.fromEntries(
      FLOW_SCENE_STATES.map((state) => [
        state,
        Object.freeze(
          SCENE_BLUEPRINTS[state].map((scene, index) => {
            const sceneId = `${state}-${scene.slug}`;
            const asset = FLOW_SCENE_ASSETS[sceneId] ?? null;
            return Object.freeze({
              id: sceneId,
              state,
              index,
              label: scene.label,
              subtitle: scene.subtitle,
              ritualLabelZh: scene.ritualLabelZh ?? null,
              artwork: asset?.artwork ?? createSceneArtworkDataUri(scene),
              artworkOriginalUrl: asset?.artworkOriginalUrl ?? null,
              artworkSourcePage: asset?.artworkSourcePage ?? null,
              artworkThumbnailUrl: asset?.artworkThumbnailUrl ?? null,
              artworkName: asset?.artworkName ?? null,
              audioUrl: asset?.audioUrl ?? null,
              audioOriginalUrl: asset?.audioOriginalUrl ?? null,
              audioSourcePage: asset?.audioSourcePage ?? null,
              audioThumbnailUrl: asset?.audioThumbnailUrl ?? null,
              audioLabel: asset?.audioLabel ?? scene.audioLabel,
              audioArtist: asset?.audioArtist ?? scene.audioArtist,
              audioSource: asset?.audioSource ?? scene.audioSource,
              collectionLabel:
                state === "flow"
                  ? "Deep Flow Pack"
                  : state === "focus"
                    ? "Focus Care Pack"
                    : state === "relax"
                      ? "Unwind Pack"
                      : "Sleep Drift Pack",
            });
          }),
        ),
      ]),
    ),
  );
}

export const FLOW_SCENE_CATALOG = materializeScenes();
export const FLOW_SCENE_LOOKUP = new Map(
  FLOW_SCENE_STATES.flatMap((state) => FLOW_SCENE_CATALOG[state].map((scene) => [scene.id, scene])),
);

export function createDefaultFlowScenesByState() {
  return Object.fromEntries(FLOW_SCENE_STATES.map((state) => [state, FLOW_SCENE_CATALOG[state][0].id]));
}

export function normalizeFlowState(value) {
  return FLOW_SCENE_STATES.includes(value) ? value : "focus";
}

export function getFlowScenesForState(flowState) {
  return FLOW_SCENE_CATALOG[normalizeFlowState(flowState)];
}

export function getFlowSceneById(sceneId) {
  return FLOW_SCENE_LOOKUP.get(sceneId) ?? null;
}

export function getFlowSceneAudioLibraryPath(scene, libraryRoot = "Codex/flow-scenes-audio") {
  const audioUrl = scene?.audioUrl ?? "";
  const fileName = String(audioUrl).split("/").filter(Boolean).at(-1) ?? "";
  if (!fileName) {
    return null;
  }

  const normalizedRoot = String(libraryRoot ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");

  return normalizedRoot ? `${normalizedRoot}/${fileName}` : fileName;
}

export function normalizeFlowScenesByState(value) {
  const defaults = createDefaultFlowScenesByState();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  return Object.fromEntries(
    FLOW_SCENE_STATES.map((state) => {
      const candidate = getFlowSceneById(value[state]);
      return [state, candidate?.state === state ? candidate.id : defaults[state]];
    }),
  );
}

export function resolveFlowSceneSelection({ flowState, sceneId = null, sceneIndex = null, scenesByState = null } = {}) {
  const normalizedState = normalizeFlowState(flowState);
  const stateScenes = getFlowScenesForState(normalizedState);
  const normalizedMemory = normalizeFlowScenesByState(scenesByState);

  let scene = getFlowSceneById(sceneId);
  if (!scene || scene.state !== normalizedState) {
    scene = getFlowSceneById(normalizedMemory[normalizedState]);
  }

  if ((!scene || scene.state !== normalizedState) && Number.isFinite(Number(sceneIndex))) {
    const index = ((Number(sceneIndex) % stateScenes.length) + stateScenes.length) % stateScenes.length;
    scene = stateScenes[index];
  }

  if (!scene || scene.state !== normalizedState) {
    scene = stateScenes[0];
  }

  return {
    scene,
    sceneId: scene.id,
    sceneIndex: scene.index,
    scenesByState: {
      ...normalizedMemory,
      [normalizedState]: scene.id,
    },
  };
}

export function getNextFlowSceneSelection({ flowState, sceneId = null, scenesByState = null, step = 1 } = {}) {
  const current = resolveFlowSceneSelection({ flowState, sceneId, scenesByState });
  const stateScenes = getFlowScenesForState(current.scene.state);
  const nextScene = stateScenes[(current.scene.index + step + stateScenes.length) % stateScenes.length];
  return {
    scene: nextScene,
    sceneId: nextScene.id,
    sceneIndex: nextScene.index,
    scenesByState: {
      ...current.scenesByState,
      [nextScene.state]: nextScene.id,
    },
  };
}

export function applyFlowSceneToPlayback(playback = {}, selection) {
  const scene = selection?.scene ?? selection;
  if (!scene?.id) {
    return playback;
  }

  const nextScene = getFlowScenesForState(scene.state)[(scene.index + 1) % getFlowScenesForState(scene.state).length];
  return {
    ...playback,
    trackTitle: scene.audioLabel,
    artist: scene.audioArtist,
    album: scene.collectionLabel,
    source: scene.audioSource,
    progress: 0,
    currentTrackIndex: scene.index,
    queueLength: getFlowScenesForState(scene.state).length,
    nextTrackTitle: nextScene.audioLabel,
  };
}

export function createFlowSceneState(flowState = "focus") {
  const selection = resolveFlowSceneSelection({ flowState });
  return {
    sceneId: selection.sceneId,
    sceneIndex: selection.sceneIndex,
    scenesByState: selection.scenesByState,
  };
}
