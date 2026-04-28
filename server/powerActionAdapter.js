import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCallback);
const DEFAULT_TIMEOUT_MS = 15_000;

function createPowerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizePowerAction(type) {
  if (type === "system_reboot" || type === "system_shutdown") {
    return type;
  }

  throw createPowerError("POWER_INVALID_ACTION", `Unsupported power action: ${type}`);
}

function getDefaultCommand(type) {
  if (type === "system_reboot") {
    return process.env.TIKPAL_SYSTEM_REBOOT_COMMAND ?? "";
  }

  return process.env.TIKPAL_SYSTEM_SHUTDOWN_COMMAND ?? "";
}

export function createCommandPowerAdapter({
  rebootCommand = process.env.TIKPAL_SYSTEM_REBOOT_COMMAND ?? "",
  shutdownCommand = process.env.TIKPAL_SYSTEM_SHUTDOWN_COMMAND ?? "",
  timeoutMs = Number(process.env.TIKPAL_SYSTEM_POWER_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  execImpl = exec,
} = {}) {
  return {
    async runAction(type) {
      const normalizedType = normalizePowerAction(type);
      const command = normalizedType === "system_reboot" ? rebootCommand : shutdownCommand;

      if (!command) {
        throw createPowerError(
          "POWER_ACTION_UNAVAILABLE",
          `System power action is not configured for ${normalizedType}. Set ${normalizedType === "system_reboot" ? "TIKPAL_SYSTEM_REBOOT_COMMAND" : "TIKPAL_SYSTEM_SHUTDOWN_COMMAND"}.`,
        );
      }

      try {
        await execImpl(command, {
          timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
          shell: "/bin/sh",
        });
      } catch (error) {
        if (error?.code === "ETIMEDOUT" || error?.killed) {
          throw createPowerError("POWER_ACTION_TIMEOUT", `Power action timed out while running: ${normalizedType}`);
        }

        const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
        const stdout = typeof error?.stdout === "string" ? error.stdout.trim() : "";
        const detail = stderr || stdout || (error instanceof Error ? error.message : String(error));
        throw createPowerError("POWER_ACTION_FAILED", `Power action failed for ${normalizedType}: ${detail}`);
      }

      return {
        action: normalizedType,
        requestedAt: new Date().toISOString(),
        command,
      };
    },
    getCapabilities() {
      return {
        reboot: Boolean(rebootCommand),
        shutdown: Boolean(shutdownCommand),
      };
    },
  };
}

export function createDefaultPowerAdapter() {
  const rebootCommand = getDefaultCommand("system_reboot");
  const shutdownCommand = getDefaultCommand("system_shutdown");

  if (!rebootCommand && !shutdownCommand) {
    return null;
  }

  return createCommandPowerAdapter({
    rebootCommand,
    shutdownCommand,
  });
}
