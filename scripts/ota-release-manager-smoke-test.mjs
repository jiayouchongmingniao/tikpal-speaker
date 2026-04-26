import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFileSystemOtaManager } from "../server/otaReleaseManager.js";
import { createSystemStateStore } from "../server/systemStateStore.js";

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function writeRelease(releaseRoot, version, { healthOk = true } = {}) {
  const releasePath = path.join(releaseRoot, version);
  fs.mkdirSync(releasePath, { recursive: true });
  fs.writeFileSync(
    path.join(releasePath, "manifest.json"),
    `${JSON.stringify(
      {
        version,
        buildTime: "2026-04-26T12:00:00.000Z",
        compatibleApiVersion: "1.0.0",
        checksum: `sha256-${version}`,
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(path.join(releasePath, "health.json"), `${JSON.stringify({ ok: healthOk })}\n`);
  return releasePath;
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tikpal-ota-"));

try {
  const releaseRoot = path.join(tempDir, "releases");
  const currentPath = path.join(tempDir, "current");
  const previousPath = path.join(tempDir, "previous");
  writeRelease(releaseRoot, "0.1.0");
  writeRelease(releaseRoot, "0.1.2");
  writeRelease(releaseRoot, "0.1.3", { healthOk: false });
  fs.symlinkSync(path.join(releaseRoot, "0.1.0"), currentPath, "dir");

  test("filesystem OTA manager checks, applies, and rolls back release manifests", () => {
    const otaManager = createFileSystemOtaManager({
      releaseRoot,
      currentPath,
      previousPath,
    });
    const store = createSystemStateStore({ otaManager });

    const checked = store.runAction("ota_check", { targetVersion: "0.1.2" }, "admin_client");
    assert.equal(checked.system.otaStatus, "available");
    assert.equal(checked.system.ota.lastOperation.manifest.version, "0.1.2");

    const applied = store.runAction("ota_apply", {}, "admin_client");
    assert.equal(applied.system.version, "0.1.2");
    assert.equal(applied.system.ota.currentVersion, "0.1.2");
    assert.equal(applied.system.ota.previousVersion, "0.1.0");
    assert.equal(applied.system.ota.lastOperation.health.ok, true);
    assert.equal(fs.readlinkSync(currentPath), path.join(releaseRoot, "0.1.2"));
    assert.equal(fs.readlinkSync(previousPath), path.join(releaseRoot, "0.1.0"));

    const rolledBack = store.runAction("ota_rollback", {}, "admin_client");
    assert.equal(rolledBack.system.version, "0.1.0");
    assert.equal(rolledBack.system.ota.currentVersion, "0.1.0");
    assert.equal(fs.readlinkSync(currentPath), path.join(releaseRoot, "0.1.0"));
    assert.equal(fs.readlinkSync(previousPath), path.join(releaseRoot, "0.1.2"));
  });

  test("filesystem OTA manager rejects unhealthy releases", () => {
    const otaManager = createFileSystemOtaManager({
      releaseRoot,
      currentPath,
      previousPath,
    });
    const store = createSystemStateStore({ otaManager });
    store.runAction("ota_check", { targetVersion: "0.1.3" }, "admin_client");

    assert.throws(
      () => store.runAction("ota_apply", {}, "admin_client"),
      (error) => error.code === "OTA_HEALTH_CHECK_FAILED",
    );
    const snapshot = store.getSnapshot();
    assert.equal(snapshot.system.otaStatus, "error");
    assert.equal(snapshot.system.ota.lastErrorCode, "OTA_HEALTH_CHECK_FAILED");
    assert.equal(snapshot.system.ota.lastOperation.status, "failed");
    assert.equal(snapshot.system.ota.lastOperation.releasePath, path.join(releaseRoot, "0.1.3"));
    assert.equal(snapshot.system.ota.canRollback, true);
    assert.equal(fs.readlinkSync(currentPath), path.join(releaseRoot, "0.1.0"));
    assert.equal(fs.readlinkSync(previousPath), path.join(releaseRoot, "0.1.0"));
  });

  test("filesystem OTA manager restores release pointers when rollback health fails", () => {
    const otaManager = createFileSystemOtaManager({
      releaseRoot,
      currentPath,
      previousPath,
    });
    const store = createSystemStateStore({ otaManager });
    store.runAction("ota_check", { targetVersion: "0.1.2" }, "admin_client");
    store.runAction("ota_apply", {}, "admin_client");

    fs.writeFileSync(path.join(releaseRoot, "0.1.0", "health.json"), `${JSON.stringify({ ok: false })}\n`);
    assert.throws(
      () => store.runAction("ota_rollback", {}, "admin_client"),
      (error) => error.code === "OTA_HEALTH_CHECK_FAILED",
    );

    const snapshot = store.getSnapshot();
    assert.equal(snapshot.system.otaStatus, "error");
    assert.equal(snapshot.system.version, "0.1.2");
    assert.equal(snapshot.system.ota.currentVersion, "0.1.2");
    assert.equal(snapshot.system.ota.previousVersion, "0.1.0");
    assert.equal(snapshot.system.ota.canRollback, true);
    assert.equal(fs.readlinkSync(currentPath), path.join(releaseRoot, "0.1.2"));
    assert.equal(fs.readlinkSync(previousPath), path.join(releaseRoot, "0.1.0"));
  });
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log("OTA release manager smoke tests passed.");
