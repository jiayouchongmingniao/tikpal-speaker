import assert from "node:assert/strict";
import { createHttpPlayerAdapter, normalizePlayerState } from "../server/playerAdapter.js";

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

console.log("Server player adapter smoke tests passed.");
