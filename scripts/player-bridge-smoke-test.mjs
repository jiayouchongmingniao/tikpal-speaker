import assert from "node:assert/strict";
import { createHttpPlayerBridge, createPlayerBridge } from "../src/bridge/playerBridge.js";

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

await test("HTTP player bridge normalizes remote status and control responses", async () => {
  const requests = [];
  const bridge = createHttpPlayerBridge({
    baseUrl: "https://player.example.test/api",
    pollIntervalMs: 0,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      if (String(url).endsWith("/status")) {
        return {
          ok: true,
          async json() {
            return {
              state: "playing",
              volumePercent: 63,
              title: "Remote focus track",
              artist: "Remote Artist",
              service: "moOde",
              elapsedRatio: 0.42,
            };
          },
        };
      }

      assert.equal(String(url), "https://player.example.test/api/actions");
      const body = JSON.parse(options.body);
      assert.equal(body.action, "set_volume");
      assert.equal(body.volume, 77);
      return {
        ok: true,
        async json() {
          return {
            playbackState: "pause",
            volume: 77,
            trackTitle: "Remote focus track",
            source: "moOde",
            progress: 0.45,
          };
        },
      };
    },
  });

  const snapshots = [];
  const unsubscribe = bridge.subscribe((snapshot) => snapshots.push(snapshot));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(snapshots.at(-1).playbackState, "play");
  assert.equal(snapshots.at(-1).volume, 63);
  assert.equal(snapshots.at(-1).trackTitle, "Remote focus track");
  assert.equal(snapshots.at(-1).source, "moOde");

  await bridge.setVolume(77);
  assert.equal(snapshots.at(-1).playbackState, "pause");
  assert.equal(snapshots.at(-1).volume, 77);
  assert.equal(requests.some((request) => request.url.endsWith("/status")), true);
  unsubscribe();
});

await test("player bridge keeps Flow API updates while using real player adapter", async () => {
  const flowActions = [];
  const bridge = createPlayerBridge({
    playerApiBase: "https://player.example.test/api",
    flowApi: {
      async sendAction(type, payload, source) {
        flowActions.push({ type, payload, source });
      },
    },
  });
  const realBridge = createHttpPlayerBridge({
    baseUrl: "https://player.example.test/api",
  });
  assert.equal(typeof realBridge.subscribe, "function");
  assert.equal(typeof bridge.togglePlay, "function");
});

console.log("Player bridge smoke tests passed.");
