import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { createAppServer } from "../server/index.js";

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function createMockPlayerServer() {
  const actions = [];
  const server = http.createServer(async (request, response) => {
    if (request.url === "/player/status" && request.method === "GET") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          state: "play",
          volume: 58,
          trackTitle: "Validation Mock Track",
          player: "mock-player",
        }),
      );
      return;
    }

    if (request.url === "/player/actions" && request.method === "POST") {
      let raw = "";
      for await (const chunk of request) {
        raw += chunk;
      }
      const body = raw ? JSON.parse(raw) : {};
      actions.push(body.action);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          state: body.action === "toggle_play" ? "pause" : "play",
          volume: body.volume ?? 58,
          trackTitle: body.action === "next_track" ? "Next validation track" : body.action === "prev_track" ? "Previous validation track" : "Validation Mock Track",
          player: "mock-player",
        }),
      );
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });

  return {
    server,
    actions,
  };
}

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

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

await test("validation capture records player and portable evidence without leaking secrets", async () => {
  const apiServer = createAppServer({ apiKey: "validation-admin-key" });
  const player = createMockPlayerServer();
  await Promise.all([listen(apiServer), listen(player.server)]);

  try {
    const apiPort = apiServer.address().port;
    const playerPort = player.server.address().port;
    const result = await runNode([
      "scripts/target-device-validation-capture.mjs",
      "--api-base",
      `http://127.0.0.1:${apiPort}/api/v1/system`,
      "--api-key",
      "validation-admin-key",
      "--player-api-base",
      `http://127.0.0.1:${playerPort}/player`,
      "--exercise-portable",
    ]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Player Evidence/);
    assert.match(result.stdout, /Validation Mock Track/);
    assert.match(result.stdout, /Portable Evidence/);
    assert.equal(player.actions.includes("toggle_play"), true);
    assert.equal(player.actions.includes("set_volume"), true);
    assert.equal(player.actions.includes("next_track"), true);
    assert.equal(player.actions.includes("prev_track"), true);
    assert.equal(/sess_[a-z0-9]+/i.test(result.stdout), false);
    assert.equal(result.stdout.includes("validation-admin-key"), false);
    assert.equal(result.stdout.includes("Bearer "), false);
  } finally {
    await Promise.all([close(apiServer), close(player.server)]);
  }
});

await test("systemd verify is diagnostic on non-systemd hosts", async () => {
  const child = spawn("bash", ["deploy/systemd/install-systemd-services.sh", "--verify"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_DIR: process.cwd(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  const code = await new Promise((resolve) => child.on("close", resolve));
  assert.equal(code, 0);
  assert.match(stdout, /diagnostic: /);
});

console.log("Validation tooling smoke tests passed.");
