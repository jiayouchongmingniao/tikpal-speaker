import fs from "node:fs";
import path from "node:path";

function createOtaError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureManifest(releasePath, targetVersion) {
  if (!fs.existsSync(releasePath)) {
    throw createOtaError("OTA_RELEASE_NOT_FOUND", `OTA release not found: ${releasePath}`);
  }

  const manifestPath = path.join(releasePath, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw createOtaError("OTA_MANIFEST_MISSING", `OTA manifest not found: ${manifestPath}`);
  }

  const manifest = readJsonFile(manifestPath);
  if (!manifest.version || manifest.version !== targetVersion) {
    throw createOtaError("OTA_MANIFEST_INVALID", `OTA manifest version does not match ${targetVersion}`);
  }

  return {
    manifest,
    manifestPath,
  };
}

function replaceSymlink(linkPath, targetPath) {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.rmSync(linkPath, { force: true, recursive: true });
  fs.symlinkSync(targetPath, linkPath, "dir");
}

function restoreSymlinks(pairs) {
  for (const [linkPath, targetPath] of pairs) {
    replaceSymlink(linkPath, targetPath);
  }
}

export function createFileSystemOtaManager({
  releaseRoot = process.env.TIKPAL_OTA_RELEASE_ROOT || "/opt/tikpal/app/releases",
  currentPath = process.env.TIKPAL_OTA_CURRENT_PATH || "/opt/tikpal/app/current",
  previousPath = process.env.TIKPAL_OTA_PREVIOUS_PATH || "/opt/tikpal/app/previous",
  healthFile = process.env.TIKPAL_OTA_HEALTH_FILE || "health.json",
} = {}) {
  function getReleasePath(version) {
    return path.join(releaseRoot, version);
  }

  function checkHealth(releasePath) {
    const healthPath = path.join(releasePath, healthFile);
    if (!fs.existsSync(healthPath)) {
      return {
        ok: true,
        healthPath,
        skipped: true,
      };
    }

    const health = readJsonFile(healthPath);
    if (health.ok === false) {
      throw createOtaError("OTA_HEALTH_CHECK_FAILED", `OTA health check failed for ${releasePath}`, {
        health,
        healthPath,
        releasePath,
      });
    }

    return {
      ok: true,
      healthPath,
      skipped: false,
    };
  }

  return {
    releaseRoot,
    currentPath,
    previousPath,
    check({ currentVersion, targetVersion }) {
      const releasePath = getReleasePath(targetVersion);
      const { manifest, manifestPath } = ensureManifest(releasePath, targetVersion);
      return {
        updateAvailable: currentVersion !== targetVersion,
        targetVersion,
        releasePath,
        manifestPath,
        manifest,
        phases: ["checking", currentVersion !== targetVersion ? "available" : "idle"],
      };
    },
    apply({ currentVersion, targetVersion }) {
      const releasePath = getReleasePath(targetVersion);
      const { manifest, manifestPath } = ensureManifest(releasePath, targetVersion);
      replaceSymlink(previousPath, getReleasePath(currentVersion));
      replaceSymlink(currentPath, releasePath);
      let health;
      try {
        health = checkHealth(releasePath);
      } catch (error) {
        restoreSymlinks([
          [currentPath, getReleasePath(currentVersion)],
          [previousPath, getReleasePath(currentVersion)],
        ]);
        error.currentVersion = currentVersion;
        error.previousVersion = currentVersion;
        error.targetVersion = targetVersion;
        error.releasePath = releasePath;
        error.manifestPath = manifestPath;
        error.manifest = manifest;
        throw error;
      }

      return {
        currentVersion: targetVersion,
        previousVersion: currentVersion,
        targetVersion,
        releasePath,
        manifestPath,
        manifest,
        health,
        phases: ["verifying", "applying", "restarting", "health_check", "completed"],
      };
    },
    rollback({ currentVersion, previousVersion }) {
      const releasePath = getReleasePath(previousVersion);
      const { manifest, manifestPath } = ensureManifest(releasePath, previousVersion);
      replaceSymlink(previousPath, getReleasePath(currentVersion));
      replaceSymlink(currentPath, releasePath);
      let health;
      try {
        health = checkHealth(releasePath);
      } catch (error) {
        restoreSymlinks([
          [currentPath, getReleasePath(currentVersion)],
          [previousPath, getReleasePath(previousVersion)],
        ]);
        error.currentVersion = currentVersion;
        error.previousVersion = previousVersion;
        error.targetVersion = null;
        error.releasePath = releasePath;
        error.manifestPath = manifestPath;
        error.manifest = manifest;
        throw error;
      }

      return {
        currentVersion: previousVersion,
        previousVersion: currentVersion,
        targetVersion: null,
        releasePath,
        manifestPath,
        manifest,
        health,
        phases: ["rollback", "restarting", "health_check", "completed"],
      };
    },
  };
}
