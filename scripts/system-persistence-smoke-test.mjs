import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createJsonFilePersistence } from "../server/localPersistence.js";
import { createJsonFileSecretStore } from "../server/localSecretStore.js";
import { createScreenContext } from "../server/screenContextService.js";
import { createSystemStateStore } from "../server/systemStateStore.js";

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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tikpal-persistence-"));
const persistencePath = path.join(tempDir, "system-state.json");
const secretPath = path.join(tempDir, "connector-secrets.json");
const persistence = createJsonFilePersistence(persistencePath);
const secretStore = createJsonFileSecretStore(secretPath);

try {
  await test("configured render profile overrides stale persisted profile", () => {
    const previousProfile = process.env.RPI_RENDER_PROFILE;
    process.env.RPI_RENDER_PROFILE = "balanced";
    persistence.write({
      version: 1,
      savedAt: new Date().toISOString(),
      state: {
        system: {
          renderProfile: "stable",
        },
      },
    });

    try {
      const store = createSystemStateStore({ persistence, secretStore });
      assert.equal(store.getSnapshot().system.renderProfile, "balanced");
      assert.equal(store.getRuntimeProfile().renderProfile, "balanced");
    } finally {
      if (previousProfile === undefined) {
        delete process.env.RPI_RENDER_PROFILE;
      } else {
        process.env.RPI_RENDER_PROFILE = previousProfile;
      }
    }
  });

  await test("flow diagnostic mode restores from persisted state", () => {
    persistence.write({
      version: 1,
      savedAt: new Date().toISOString(),
      state: {
        system: {
          flowDiagnosticMode: "static",
        },
      },
    });

    const store = createSystemStateStore({ persistence, secretStore });
    assert.equal(store.getSnapshot().system.flowDiagnosticMode, "static");
    assert.equal(store.getRuntimeSummary().flowDiagnosticMode, "static");
  });

  await test("system state, sessions, pairing, and connector metadata survive restart", () => {
    const firstStore = createSystemStateStore({ persistence, secretStore });
    const session = firstStore.createSession(
      {
        deviceId: "portable-persist-001",
        name: "Persistent Portable",
        role: "controller",
        capabilities: ["mode_switch", "screen_control", "creative_care"],
      },
      "portable_controller",
    );
    const pairing = firstStore.createPairingCode({
      role: "controller",
      capabilities: ["mode_switch"],
    });
    firstStore.bindIntegration(
      "calendar",
      {
        accountLabel: "calendar.user@example.com",
        accessToken: "secret-access-token",
        refreshToken: "secret-refresh-token",
        tokenExpiresAt: "2026-04-27T00:00:00.000Z",
      },
      "admin_client",
    );
    firstStore.patchIntegration(
      "calendar",
      {
        connected: true,
        status: "ok",
        currentEvent: {
          id: "cal_current",
          title: "Persistent Deep Work",
        },
        nextEvent: {
          id: "cal_next",
          title: "Persistent Review",
        },
        remainingEvents: 2,
      },
      "mock_sync_worker",
    );
    firstStore.runAction(
      "voice_capture_submit",
      {
        transcript: "I feel scattered but one idea is ready.",
        moodLabel: "scattered",
        moodIntensity: 0.7,
      },
      "portable_controller",
    );
    firstStore.runAction("screen_set_focus_item", { title: "Persist manual focus" }, "portable_controller");

    const rawPersistence = fs.readFileSync(persistencePath, "utf8");
    assert.equal(rawPersistence.includes("secret-access-token"), false);
    assert.equal(rawPersistence.includes("secret-refresh-token"), false);
    const rawSecrets = fs.readFileSync(secretPath, "utf8");
    assert.equal(rawSecrets.includes("secret-access-token"), true);
    assert.equal(rawSecrets.includes("secret-refresh-token"), true);

    const secondStore = createSystemStateStore({ persistence, secretStore });
    const restoredSession = secondStore.getSessionByToken(session.token, { touch: false });
    assert.equal(restoredSession.id, session.id);
    assert.equal(restoredSession.name, "Persistent Portable");

    assert.equal(secondStore.hasIntegrationCredential("calendar"), true);
    assert.equal(secondStore.getSnapshot().integrations.calendar.credentialRef, "local:calendar:calendar.user@example.com");
    assert.equal(secondStore.getIntegrationCredential("calendar").accessToken, "secret-access-token");
    assert.equal(secondStore.getSnapshot().creativeCare.moodLabel, "scattered");
    assert.equal(secondStore.getSnapshot().screen.currentTask, "Persist manual focus");

    const restoredContext = createScreenContext(secondStore.getSnapshot());
    assert.equal(restoredContext.focusItem.title, "Persist manual focus");
    assert.equal(restoredContext.currentBlock.title, "Persistent Deep Work");
    assert.equal(restoredContext.nextBlock.title, "Persistent Review");

    const claimedSession = secondStore.claimPairingCode(pairing.code, {
      deviceId: "portable-claimed-after-restart",
      name: "Claimed After Restart",
    });
    assert.equal(claimedSession.role, "controller");

    const thirdStore = createSystemStateStore({ persistence, secretStore });
    assert.throws(() => thirdStore.claimPairingCode(pairing.code, {}), /Pairing code is invalid or expired/);

    thirdStore.revokeIntegration("calendar", "admin_client");
    assert.equal(thirdStore.getIntegrationCredential("calendar"), null);
    assert.equal(fs.readFileSync(secretPath, "utf8").includes("secret-access-token"), false);
  });
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log("Persistence smoke tests passed.");
