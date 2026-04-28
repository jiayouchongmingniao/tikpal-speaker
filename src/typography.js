export const FONT_PRESET_STORAGE_KEY = "tikpal-ui-font-preset";
export const DEFAULT_FONT_PRESET_ID = "default-sans";

export const FONT_PRESETS = [
  {
    id: "default-sans",
    label: "Default Sans",
    description: "Current Tikpal look with a clean modern sans.",
    preview: "Listen softly. Focus clearly.",
    fontFamily: '"Inter", "SF Pro Display", "Segoe UI", sans-serif',
  },
  {
    id: "humanist-sans",
    label: "Humanist Sans",
    description: "Softer and warmer for long, calm reading.",
    preview: "Gentle rhythm. Spacious attention.",
    fontFamily: '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: "editorial-serif",
    label: "Editorial Serif",
    description: "More reflective and expressive for rest moments.",
    preview: "Slow down. Let one thought bloom.",
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", "Times New Roman", serif',
  },
  {
    id: "mono-accent",
    label: "Mono Accent",
    description: "A utility-forward option with a crisp technical rhythm.",
    preview: "Breathe in. Count the next step.",
    fontFamily: '"IBM Plex Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
];

const FONT_PRESET_MAP = new Map(FONT_PRESETS.map((preset) => [preset.id, preset]));

export function normalizeFontPresetId(value) {
  return FONT_PRESET_MAP.has(value) ? value : DEFAULT_FONT_PRESET_ID;
}

export function getFontPreset(id) {
  return FONT_PRESET_MAP.get(normalizeFontPresetId(id));
}

export function getFontFamily(id) {
  return getFontPreset(id).fontFamily;
}

export function readStoredFontPreset(storage = globalThis?.localStorage) {
  try {
    return normalizeFontPresetId(storage?.getItem(FONT_PRESET_STORAGE_KEY) ?? DEFAULT_FONT_PRESET_ID);
  } catch {
    return DEFAULT_FONT_PRESET_ID;
  }
}

export function writeStoredFontPreset(id, storage = globalThis?.localStorage) {
  const normalizedId = normalizeFontPresetId(id);

  try {
    storage?.setItem(FONT_PRESET_STORAGE_KEY, normalizedId);
  } catch {
    // Ignore storage write failures and still apply the chosen font for this session.
  }

  return normalizedId;
}

export function applyFontPreset(id, root = globalThis?.document?.documentElement) {
  const normalizedId = normalizeFontPresetId(id);

  if (root) {
    root.style.setProperty("--app-font-family", getFontFamily(normalizedId));
    root.dataset.fontPreset = normalizedId;
  }

  return normalizedId;
}

export function bootstrapFontPreset({
  storage = globalThis?.localStorage,
  root = globalThis?.document?.documentElement,
} = {}) {
  const presetId = readStoredFontPreset(storage);
  applyFontPreset(presetId, root);
  return presetId;
}

export function persistAndApplyFontPreset(id, { storage = globalThis?.localStorage, root = globalThis?.document?.documentElement } = {}) {
  const normalizedId = writeStoredFontPreset(id, storage);
  applyFontPreset(normalizedId, root);
  return normalizedId;
}
