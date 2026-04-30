import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const repoRoot = "/Users/pom/Code/speaker";
const publicRoot = path.join(repoRoot, "public", "flow-scenes");
const imageRoot = path.join(publicRoot, "images");
const audioRoot = path.join(publicRoot, "audio");
const generatedModulePath = path.join(repoRoot, "src", "viewmodels", "flowSceneAssets.generated.js");
const manifestPath = path.join(publicRoot, "manifest.json");

const sceneOrder = [
  "focus-studio-lofi",
  "focus-paper-lantern",
  "focus-quiet-library",
  "focus-signal-desks",
  "focus-cinder-notes",
  "flow-white-noise-veil",
  "flow-ocean-hiss",
  "flow-air-column",
  "flow-violet-mach",
  "flow-night-fan",
  "relax-ember-mist",
  "relax-cedar-cloud",
  "relax-pearl-rain",
  "relax-orchid-air",
  "relax-amber-room",
  "sleep-power-nap",
  "sleep-quick-reset",
  "sleep-between-meetings",
  "sleep-eyes-closed",
  "sleep-moon-hush",
];

const inputFiles = {
  musicA: "/tmp/pixabay-music-batch-a.json",
  musicB: "/tmp/pixabay-music-batch-b.json",
  photoA: "/tmp/pixabay-photo-batch-a.json",
  photoB: "/tmp/pixabay-photo-batch-b.json",
};

const imageSelectionByScene = {
  "focus-studio-lofi": "/photos/blue-purple-top-modern-modern-art-60201/",
  "focus-paper-lantern": "/photos/mountain-sunset-landscape-panoramic-3022908/",
  "focus-quiet-library": "/photos/texture-light-blue-glow-pattern-5054172/",
  "focus-signal-desks": "/photos/background-abstract-2672561/",
  "focus-cinder-notes": "/photos/purple-pink-ink-smoke-background-7666721/",
  "flow-white-noise-veil": "/photos/water-drops-gradient-background-6373296/",
  "flow-ocean-hiss": "/photos/ocean-mountains-lake-blue-water-8283187/",
  "flow-air-column": "/photos/water-panoramic-sea-sky-nature-3270578/",
  "flow-violet-mach": "/photos/lights-bokeh-blue-purple-led-2171555/",
  "flow-night-fan": "/photos/mt-fuji-volcano-silhouettes-clouds-2232246/",
  "relax-ember-mist": "/photos/background-paint-pattern-smoke-ink-6771145/",
  "relax-cedar-cloud": "/photos/hills-fog-evening-atmosphere-nature-9352436/",
  "relax-pearl-rain": "/photos/sky-background-nature-light-5060089/",
  "relax-orchid-air": "/photos/ink-water-background-abstract-6734478/",
  "relax-amber-room": "/photos/abstract-light-shining-69243/",
  "sleep-power-nap": "/photos/forest-trees-nature-silhouette-4023269/",
  "sleep-quick-reset": "/photos/panoramic-nature-panorama-landscape-3286081/",
  "sleep-between-meetings": "/photos/beautiful-deep-space-cosmic-7305546/",
  "sleep-eyes-closed": "/photos/background-bokeh-abstract-stars-7633382/",
  "sleep-moon-hush": "/photos/bokeh-lights-background-wallpaper-2072271/",
};

function extractExtension(url) {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  if (!ext) {
    throw new Error(`Could not infer extension from ${url}`);
  }
  return ext;
}

function titleFromMusicName(name) {
  return name.replace(/\s*\|\s*Royalty-free Music\s*$/u, "").trim();
}

function inferArtistFromMusicUrl(url) {
  const filename = new URL(url).searchParams.get("filename") ?? "";
  const stem = filename.replace(/\.[^.]+$/u, "");
  const dashIndex = stem.indexOf("-");
  const rawArtist = dashIndex > 0 ? stem.slice(0, dashIndex) : stem;
  return rawArtist
    .split(/[_-]+/u)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function downloadFile(url, destinationPath) {
  try {
    await fs.access(destinationPath);
    return { downloaded: false, error: null };
  } catch {
    // File does not exist yet.
  }

  try {
    await execFile("curl", ["-L", "--fail", "--silent", "--show-error", "--max-time", "120", "--output", destinationPath, url], {
      maxBuffer: 1024 * 1024,
    });
    return { downloaded: true, error: null };
  } catch (error) {
    return {
      downloaded: false,
      error: error.stderr?.trim() || error.stdout?.trim() || error.message,
    };
  }
}

function serializeObject(value, indent = 0) {
  const pad = "  ".repeat(indent);
  const nextPad = "  ".repeat(indent + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    return `[\n${value.map((item) => `${nextPad}${serializeObject(item, indent + 1)}`).join(",\n")}\n${pad}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "{}";
    }
    return `{\n${entries
      .map(([key, item]) => `${nextPad}${JSON.stringify(key)}: ${serializeObject(item, indent + 1)}`)
      .join(",\n")}\n${pad}}`;
  }

  return JSON.stringify(value);
}

async function main() {
  const [musicA, musicB, photoA, photoB] = await Promise.all([
    readJson(inputFiles.musicA),
    readJson(inputFiles.musicB),
    readJson(inputFiles.photoA),
    readJson(inputFiles.photoB),
  ]);

  const allMusic = [...musicA, ...musicB];
  const allPhotos = [...photoA, ...photoB];
  const photoByPath = new Map(allPhotos.map((item) => [item.path, item]));

  if (allMusic.length !== sceneOrder.length) {
    throw new Error(`Expected ${sceneOrder.length} music entries, received ${allMusic.length}`);
  }

  for (const sceneId of sceneOrder) {
    if (!photoByPath.has(imageSelectionByScene[sceneId])) {
      throw new Error(`Missing photo selection for ${sceneId}: ${imageSelectionByScene[sceneId]}`);
    }
  }

  await Promise.all([ensureDir(imageRoot), ensureDir(audioRoot)]);

  const manifest = [];
  let downloadedCount = 0;
  const failures = [];

  for (const [index, sceneId] of sceneOrder.entries()) {
    const music = allMusic[index];
    const photo = photoByPath.get(imageSelectionByScene[sceneId]);
    const imageExt = extractExtension(photo.contentUrl);
    const audioExt = extractExtension(music.contentUrl);
    const imageFileName = `${sceneId}${imageExt}`;
    const audioFileName = `${sceneId}${audioExt}`;
    const imageDestination = path.join(imageRoot, imageFileName);
    const audioDestination = path.join(audioRoot, audioFileName);

    const imageResult = await downloadFile(photo.contentUrl, imageDestination);
    const audioResult = await downloadFile(music.contentUrl, audioDestination);
    downloadedCount += Number(imageResult.downloaded);
    downloadedCount += Number(audioResult.downloaded);

    if (imageResult.error) {
      failures.push({ sceneId, type: "image", url: photo.contentUrl, error: imageResult.error });
    }
    if (audioResult.error) {
      failures.push({ sceneId, type: "audio", url: music.contentUrl, error: audioResult.error });
    }

    manifest.push({
      sceneId,
      artwork: {
        file: imageResult.error ? null : `/flow-scenes/images/${imageFileName}`,
        sourcePage: `https://pixabay.com${photo.path}`,
        contentUrl: photo.contentUrl,
        thumbnailUrl: photo.thumbnailUrl ?? null,
        width: photo.width ?? null,
        height: photo.height ?? null,
        name: photo.name,
        provider: "Pixabay",
        downloadError: imageResult.error,
      },
      audio: {
        file: audioResult.error ? null : `/flow-scenes/audio/${audioFileName}`,
        sourcePage: `https://pixabay.com${music.path}`,
        contentUrl: music.contentUrl,
        thumbnailUrl: music.thumbnailUrl ?? null,
        name: titleFromMusicName(music.name),
        artist: inferArtistFromMusicUrl(music.contentUrl),
        provider: "Pixabay Music",
        downloadError: audioResult.error,
      },
    });
  }

  const generatedModule = `export const FLOW_SCENE_ASSETS = Object.freeze(${serializeObject(
    Object.fromEntries(
      manifest.map((entry) => [
        entry.sceneId,
        {
          artwork: entry.artwork.file,
          artworkOriginalUrl: entry.artwork.contentUrl,
          artworkSourcePage: entry.artwork.sourcePage,
          artworkThumbnailUrl: entry.artwork.thumbnailUrl,
          artworkName: entry.artwork.name,
          audioUrl: entry.audio.file,
          audioOriginalUrl: entry.audio.contentUrl,
          audioSourcePage: entry.audio.sourcePage,
          audioThumbnailUrl: entry.audio.thumbnailUrl,
          audioLabel: entry.audio.name,
          audioArtist: entry.audio.artist,
          audioSource: entry.audio.provider,
        },
      ]),
    ),
  )});\n`;

  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceFiles: inputFiles,
        failures,
        items: manifest,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await fs.writeFile(generatedModulePath, generatedModule, "utf8");

  console.log(`Imported ${manifest.length} scenes and wrote ${downloadedCount} new files.`);
  if (failures.length > 0) {
    console.log(`Encountered ${failures.length} download failures.`);
  }
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Generated module: ${generatedModulePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
