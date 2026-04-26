import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAppServer } from "../server/index.js";
import { createSystemStateStore } from "../server/systemStateStore.js";
import { createFileSystemOtaManager } from "../server/otaReleaseManager.js";

function parseArgs(argv) {
  const args = {
    out: null,
    apiKey: process.env.TIKPAL_API_KEY || "dev-admin-key",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--out") {
      args.out = argv[index + 1] ?? args.out;
      index += 1;
    } else if (item === "--api-key") {
      args.apiKey = argv[index + 1] ?? args.apiKey;
      index += 1;
    }
  }

  return args;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readLinkSafe(linkPath) {
  try {
    return fs.readlinkSync(linkPath);
  } catch (error) {
    return `unavailable: ${error.message}`;
  }
}

async function requestJson(url, { apiKey = "", method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-Tikpal-Key": apiKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    value: payload,
  };
}

async function withServer(apiKey, handler) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tikpal-device-validation-"));
  const releaseRoot = path.join(tempDir, "releases");
  const currentPath = path.join(tempDir, "current");
  const previousPath = path.join(tempDir, "previous");
  const restartLog = path.join(tempDir, "restart.log");

  for (const version of ["0.1.0", "0.1.1"]) {
    writeJson(path.join(releaseRoot, version, "manifest.json"), { version });
    writeJson(path.join(releaseRoot, version, "health.json"), { ok: true });
  }
  fs.symlinkSync(path.join(releaseRoot, "0.1.0"), currentPath, "dir");

  const otaManager = createFileSystemOtaManager({
    releaseRoot,
    currentPath,
    previousPath,
    restartCommand(context) {
      fs.appendFileSync(restartLog, `${context.operation}:${context.targetVersion}\n`);
      return { ok: true, command: "validation restart hook" };
    },
  });

  const store = createSystemStateStore({ otaManager });
  const server = createAppServer({ store, apiKey });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const apiBase = `http://127.0.0.1:${address.port}/api/v1/system`;

  try {
    return await handler({
      apiBase,
      tempDir,
      releaseRoot,
      currentPath,
      previousPath,
      restartLog,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function renderReport({ checks, paths }) {
  return `# tikpal-speaker Device Validation Helper

| Item | Value |
| --- | --- |
| Generated at | ${new Date().toISOString()} |
| API base | ${paths.apiBase} |
| Release root | ${paths.releaseRoot} |
| Current symlink | ${paths.currentLink} |
| Previous symlink | ${paths.previousLink} |

## Checks

| Area | Status | Evidence |
| --- | --- | --- |
| OTA check | ${checks.otaCheck.ok ? "pass" : "fail"} | ${checks.otaCheck.status} |
| OTA apply | ${checks.otaApply.ok ? "pass" : "fail"} | ${checks.otaApply.value?.state?.system?.ota?.lastOperation?.status ?? "n/a"} |
| OTA rollback | ${checks.otaRollback.ok ? "pass" : "fail"} | ${checks.otaRollback.value?.state?.system?.ota?.lastOperation?.status ?? "n/a"} |
| portable bootstrap | ${checks.bootstrap.ok ? "pass" : "fail"} | ${checks.bootstrap.status} |
| pairing claim | ${checks.claim.ok ? "pass" : "fail"} | ${checks.claim.value?.role ?? "n/a"} |
| controller action | ${checks.action.ok ? "pass" : "fail"} | ${checks.action.value?.result ?? "n/a"} |
| voice capture | ${checks.voice.ok ? "pass" : "fail"} | ${checks.voice.value?.state?.creativeCare?.metadata?.captureLength ?? "n/a"} |

## Restart Hook

\`\`\`
${checks.restartLog || "empty"}
\`\`\`
`;
}

const args = parseArgs(process.argv.slice(2));
const report = await withServer(args.apiKey, async (paths) => {
  const otaCheck = await requestJson(`${paths.apiBase}/ota/check`, {
    apiKey: args.apiKey,
    method: "POST",
    body: { targetVersion: "0.1.1", source: "validation_device" },
  });
  const otaApply = await requestJson(`${paths.apiBase}/ota/apply`, {
    apiKey: args.apiKey,
    method: "POST",
    body: { source: "validation_device" },
  });
  const otaRollback = await requestJson(`${paths.apiBase}/ota/rollback`, {
    apiKey: args.apiKey,
    method: "POST",
    body: { source: "validation_device" },
  });
  const pairing = await requestJson(`${paths.apiBase}/pairing-codes`, {
    apiKey: args.apiKey,
    method: "POST",
    body: { role: "controller", ttlSec: 300 },
  });
  const claim = await requestJson(`${paths.apiBase}/pairing-codes/claim`, {
    method: "POST",
    body: { code: pairing.value?.code, deviceId: "validation-portable", name: "Validation Portable" },
  });
  const token = claim.value?.token ?? "";
  const bootstrap = await fetch(`${paths.apiBase}/portable/bootstrap`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => ({ ok: response.ok, status: response.status, value: await response.json().catch(() => null) }));
  const action = await fetch(`${paths.apiBase}/actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type: "set_mode", payload: { mode: "screen" }, source: "validation_portable" }),
  }).then(async (response) => ({ ok: response.ok, status: response.status, value: await response.json().catch(() => null) }));
  const voice = await fetch(`${paths.apiBase}/actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: "voice_capture_submit",
      payload: { transcript: "Validation voice capture.", moodLabel: "clear", moodIntensity: 0.5, careMode: "flow" },
      source: "validation_portable",
    }),
  }).then(async (response) => ({ ok: response.ok, status: response.status, value: await response.json().catch(() => null) }));

  return renderReport({
    checks: {
      otaCheck,
      otaApply,
      otaRollback,
      bootstrap,
      claim,
      action,
      voice,
      restartLog: fs.existsSync(paths.restartLog) ? fs.readFileSync(paths.restartLog, "utf8").trim() : "",
    },
    paths: {
      ...paths,
      currentLink: readLinkSafe(paths.currentPath),
      previousLink: readLinkSafe(paths.previousPath),
    },
  });
});

if (args.out) {
  fs.writeFileSync(args.out, report);
}

console.log(report);
