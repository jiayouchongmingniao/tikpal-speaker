import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

await test("systemd dry-run includes kiosk service template", async () => {
  const child = spawn("bash", ["deploy/systemd/install-systemd-services.sh", "--dry-run"], {
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
  assert.match(stdout, /# tikpal-kiosk\.service/);
  assert.match(stdout, /ExecStart=\/usr\/bin\/env bash -lc 'APP_DIR=".*" \/usr\/bin\/startx ".*deploy\/chromium\/start-tikpal-kiosk-session\.sh" -- :0 -br -nocursor'/);
});

await test("kiosk launcher check reports missing dependencies clearly", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tikpal-kiosk-check-"));
  const flagsPath = path.join(tempDir, "chromium-flags.conf");
  const policyDir = path.join(tempDir, "policies");
  await fs.mkdir(policyDir, { recursive: true });
  await fs.writeFile(flagsPath, "--start-fullscreen\n");

  const child = spawn("bash", ["deploy/chromium/launch-tikpal-kiosk.sh", "--check"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_DIR: process.cwd(),
      TIKPAL_CHROMIUM_BIN: path.join(tempDir, "missing-chromium"),
      TIKPAL_CHROMIUM_FLAGS_FILE: flagsPath,
      TIKPAL_CHROMIUM_POLICY_DIR: policyDir,
      TIKPAL_KIOSK_DISPLAY: ":0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const code = await new Promise((resolve) => child.on("close", resolve));
  assert.equal(code, 1);
  assert.match(stderr, /Chromium binary not found or not executable/);
});

await test("kiosk launcher check fails when managed policy is missing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tikpal-kiosk-policy-"));
  const flagsPath = path.join(tempDir, "chromium-flags.conf");
  const chromiumPath = path.join(tempDir, "chromium-browser");
  const policyDir = path.join(tempDir, "policies");
  await fs.mkdir(policyDir, { recursive: true });
  await fs.writeFile(flagsPath, "--start-fullscreen\n");
  await fs.writeFile(chromiumPath, "#!/usr/bin/env bash\nexit 0\n");
  await fs.chmod(chromiumPath, 0o755);

  const child = spawn("bash", ["deploy/chromium/launch-tikpal-kiosk.sh", "--check"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_DIR: process.cwd(),
      TIKPAL_CHROMIUM_BIN: chromiumPath,
      TIKPAL_CHROMIUM_FLAGS_FILE: flagsPath,
      TIKPAL_CHROMIUM_POLICY_DIR: policyDir,
      TIKPAL_KIOSK_DISPLAY: ":0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const code = await new Promise((resolve) => child.on("close", resolve));
  assert.equal(code, 1);
  assert.match(stderr, /managed policy file not found/);
});

await test("rpi calibration report renders scenario and soak sections", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tikpal-rpi-report-"));
  const loopPath = path.join(tempDir, "loop.json");
  const flowPath = path.join(tempDir, "flow.json");
  const mixedPath = path.join(tempDir, "mixed.json");
  const soakPath = path.join(tempDir, "soak.json");
  const baseTs = Date.now();
  const createSamples = (fpsValues, tiers) => ({
    items: fpsValues.map((fps, index) => ({
      timestamp: new Date(baseTs + index * 3000).toISOString(),
      avgFps: fps,
      interactionLatencyMs: 30 + index,
      memoryUsageMb: 96 + index,
      tier: tiers[index] ?? tiers[tiers.length - 1],
    })),
  });

  await fs.writeFile(loopPath, JSON.stringify(createSamples([30, 29, 28, 27, 26], ["normal", "normal", "reduced", "reduced", "reduced"])));
  await fs.writeFile(flowPath, JSON.stringify(createSamples([32, 31, 30, 31, 32], ["reduced", "reduced", "reduced", "normal", "normal"])));
  await fs.writeFile(mixedPath, JSON.stringify(createSamples([28, 27, 26, 27, 28], ["reduced", "safe", "safe", "safe", "reduced"])));
  await fs.writeFile(soakPath, JSON.stringify(createSamples([29, 29, 30, 30, 29], ["reduced", "reduced", "reduced", "reduced", "reduced"])));

  const result = await runNode([
    "scripts/rpi-calibration-report.mjs",
    "--scenario-loop",
    loopPath,
    "--scenario-flow",
    flowPath,
    "--scenario-mixed",
    mixedPath,
    "--soak",
    soakPath,
    "--profile",
    "balanced",
  ]);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Raspberry Pi Calibration Report/);
  assert.match(result.stdout, /Scenario Summary/);
  assert.match(result.stdout, /30 min Soak/);
  assert.match(result.stdout, /OpenGL Gate/);
});

console.log("Validation tooling smoke tests passed.");
