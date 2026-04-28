import assert from "node:assert/strict";
import {
  applyFontPreset,
  bootstrapFontPreset,
  DEFAULT_FONT_PRESET_ID,
  FONT_PRESET_STORAGE_KEY,
  FONT_PRESETS,
  normalizeFontPresetId,
  readStoredFontPreset,
  writeStoredFontPreset,
} from "../src/typography.js";

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function createStorage(initialValue = null) {
  let value = initialValue;

  return {
    getItem(key) {
      return key === FONT_PRESET_STORAGE_KEY ? value : null;
    },
    setItem(key, nextValue) {
      if (key === FONT_PRESET_STORAGE_KEY) {
        value = nextValue;
      }
    },
  };
}

test("font presets expose a stable default preset", () => {
  assert.equal(FONT_PRESETS.some((preset) => preset.id === DEFAULT_FONT_PRESET_ID), true);
  assert.equal(normalizeFontPresetId("missing-preset"), DEFAULT_FONT_PRESET_ID);
});

test("stored preset falls back cleanly when the value is missing or invalid", () => {
  assert.equal(readStoredFontPreset(createStorage()), DEFAULT_FONT_PRESET_ID);
  assert.equal(readStoredFontPreset(createStorage("editorial-serif")), "editorial-serif");
  assert.equal(readStoredFontPreset(createStorage("broken-value")), DEFAULT_FONT_PRESET_ID);
});

test("writing a preset normalizes the value before persisting", () => {
  const storage = createStorage();

  assert.equal(writeStoredFontPreset("humanist-sans", storage), "humanist-sans");
  assert.equal(readStoredFontPreset(storage), "humanist-sans");
  assert.equal(writeStoredFontPreset("unknown-value", storage), DEFAULT_FONT_PRESET_ID);
  assert.equal(readStoredFontPreset(storage), DEFAULT_FONT_PRESET_ID);
});

test("bootstrapping a preset applies the CSS variable and data attribute", () => {
  const storage = createStorage("mono-accent");
  const root = {
    dataset: {},
    style: {
      properties: new Map(),
      setProperty(key, value) {
        this.properties.set(key, value);
      },
    },
  };

  assert.equal(bootstrapFontPreset({ storage, root }), "mono-accent");
  assert.equal(root.dataset.fontPreset, "mono-accent");
  assert.equal(root.style.properties.get("--app-font-family").includes("IBM Plex Mono"), true);
  assert.equal(applyFontPreset("invalid-font", root), DEFAULT_FONT_PRESET_ID);
});

console.log("Typography smoke tests passed.");
