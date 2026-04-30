import assert from "node:assert/strict";
import { createHttpPlayerAdapter, createMpcPlayerAdapter, normalizePlayerState } from "../server/playerAdapter.js";

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`PASS ${name}`);
    })
    .catch((error) => {
      console.error(`FAIL ${name}`);
      throw error;
    });
}

await test("server player adapter normalizes status and command responses", async () => {
  const requests = [];
  const adapter = createHttpPlayerAdapter({
    baseUrl: "https://player.example.test/api",
    timeoutMs: 100,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      if (String(url).endsWith("/status")) {
        return {
          ok: true,
          async json() {
            return {
              status: "playing",
              volumePercent: 61,
              song: "Server bridge status",
              artist: "Device Artist",
              player: "moOde",
              elapsedRatio: 0.21,
            };
          },
        };
      }

      assert.equal(String(url), "https://player.example.test/api/actions");
      const body = JSON.parse(options.body);
      assert.equal(body.action, "set_volume");
      assert.equal(body.volume, 88);
      return {
        ok: true,
        async json() {
          return {
            state: "pause",
            volume: 88,
            trackTitle: "Server bridge command",
            source: "moOde",
            progress: 0.5,
          };
        },
      };
    },
  });

  const status = await adapter.getStatus();
  assert.equal(status.state, "play");
  assert.equal(status.volume, 61);
  assert.equal(status.trackTitle, "Server bridge status");
  assert.equal(status.source, "moOde");

  const commandState = await adapter.runAction("set_volume", { volume: 88 }, status);
  assert.equal(commandState.state, "pause");
  assert.equal(commandState.volume, 88);
  assert.equal(commandState.trackTitle, "Server bridge command");
  assert.equal(requests.length, 2);
});

await test("server player adapter preserves fallback fields when provider payload is sparse", () => {
  const state = normalizePlayerState(
    {
      state: "playing",
      volume: 44,
    },
    {
      trackTitle: "Fallback title",
      artist: "Fallback artist",
      source: "Fallback player",
      progress: 0.4,
    },
  );

  assert.equal(state.state, "play");
  assert.equal(state.volume, 44);
  assert.equal(state.trackTitle, "Fallback title");
  assert.equal(state.artist, "Fallback artist");
  assert.equal(state.source, "Fallback player");
  assert.equal(state.progress, 0.4);
});

await test("server player adapter rejects non-object payloads with a classified error", async () => {
  const adapter = createHttpPlayerAdapter({
    baseUrl: "https://player.example.test/api",
    timeoutMs: 100,
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [];
      },
    }),
  });

  await assert.rejects(
    () => adapter.getStatus(),
    (error) => error?.code === "PLAYER_INVALID_PAYLOAD",
  );
});

await test("server player adapter classifies network failures", async () => {
  const adapter = createHttpPlayerAdapter({
    baseUrl: "https://player.example.test/api",
    timeoutMs: 100,
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED");
    },
  });

  await assert.rejects(
    () => adapter.runAction("toggle_play", {}, {}),
    (error) => error?.code === "PLAYER_NETWORK_ERROR",
  );
});

await test("native mpc adapter parses status, queue, and next track metadata", async () => {
  const commands = [];
  const adapter = createMpcPlayerAdapter({
    host: "127.0.0.1",
    port: 6600,
    timeoutMs: 100,
    execFileImpl: async (command, args) => {
      commands.push({ command, args });
      if (args.at(-1) === "status") {
        return {
          stdout: [
            "Current Device Track\tDevice Artist\tNight Album",
            "[playing] #2/4   1:20/4:00 (33%)",
            "volume: 67%   repeat: off   random: off   single: off   consume: off",
          ].join("\n"),
        };
      }

      if (args.at(-1) === "playlist") {
        return {
          stdout: ["Intro", "Current Device Track", "Next Device Track", "After Hours"].join("\n"),
        };
      }

      throw new Error(`Unexpected command: ${args.join(" ")}`);
    },
  });

  const status = await adapter.getStatus();
  assert.equal(status.state, "play");
  assert.equal(status.volume, 67);
  assert.equal(status.trackTitle, "Current Device Track");
  assert.equal(status.artist, "Device Artist");
  assert.equal(status.album, "Night Album");
  assert.equal(status.source, "moOde");
  assert.equal(status.progress, 1 / 3);
  assert.equal(status.durationSec, 240);
  assert.equal(status.nextTrackTitle, "Next Device Track");
  assert.equal(status.currentTrackIndex, 1);
  assert.equal(status.queueLength, 4);
  assert.equal(commands.length, 2);
});

await test("native mpc adapter runs commands and refreshes status", async () => {
  const commands = [];
  const adapter = createMpcPlayerAdapter({
    timeoutMs: 100,
    execFileImpl: async (_command, args) => {
      commands.push(args);
      if (args.includes("toggle")) {
        return { stdout: "" };
      }

      if (args.at(-1) === "status") {
        return {
          stdout: [
            "Paused Track\tDevice Artist\tNight Album",
            "[paused] #1/2   0:10/2:00 (8%)",
            "volume: 44%   repeat: off   random: off   single: off   consume: off",
          ].join("\n"),
        };
      }

      if (args.at(-1) === "playlist") {
        return {
          stdout: ["Paused Track", "Wake Track"].join("\n"),
        };
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    },
  });

  const nextState = await adapter.runAction("toggle_play", {}, {});
  assert.equal(nextState.state, "pause");
  assert.equal(nextState.nextTrackTitle, "Wake Track");
  assert.equal(commands.some((args) => args.includes("toggle")), true);
  assert.equal(commands.filter((args) => args.at(-1) === "status").length, 1);
});

await test("native mpc adapter can replace the queue with a specific media item", async () => {
  const commands = [];
  const adapter = createMpcPlayerAdapter({
    timeoutMs: 100,
    execFileImpl: async (_command, args) => {
      commands.push(args);
      if (args.at(-1) === "clear" || args.at(-1) === "play") {
        return { stdout: "" };
      }

      if (args[args.length - 2] === "add") {
        return { stdout: "" };
      }

      if (args.at(-1) === "status") {
        return {
          stdout: [
            "Sleep Eyes Closed\tAmbient Artist\tSleep Drift Pack",
            "[playing] #1/1   0:03/5:26 (0%)",
            "volume: 25%   repeat: off   random: off   single: off   consume: off",
          ].join("\n"),
        };
      }

      if (args.at(-1) === "playlist") {
        return {
          stdout: ["Sleep Eyes Closed"].join("\n"),
        };
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    },
  });

  const nextState = await adapter.runAction("play_media", { mediaPath: "Codex/flow-scenes-audio/sleep-eyes-closed.mp3" }, {});
  assert.equal(nextState.state, "play");
  assert.equal(nextState.trackTitle, "Sleep Eyes Closed");
  assert.equal(commands.some((args) => args.at(-1) === "clear"), true);
  assert.equal(commands.some((args) => args.includes("Codex/flow-scenes-audio/sleep-eyes-closed.mp3")), true);
  assert.equal(commands.some((args) => args.at(-1) === "play"), true);
});

await test("native mpc adapter does not treat volume-only output as a fake track title", async () => {
  const adapter = createMpcPlayerAdapter({
    timeoutMs: 100,
    execFileImpl: async (_command, args) => {
      if (args.at(-1) === "status") {
        return {
          stdout: "volume: 50%   repeat: off   random: off   single: off   consume: off\n",
        };
      }

      if (args.at(-1) === "playlist") {
        return {
          stdout: "",
        };
      }

      throw new Error(`Unexpected args: ${args.join(" ")}`);
    },
  });

  const status = await adapter.getStatus({ trackTitle: "Fallback title", queueLength: 3 });
  assert.equal(status.trackTitle, null);
  assert.equal(status.queueLength, 0);
  assert.equal(status.source, "moOde");
});

console.log("Server player adapter smoke tests passed.");
