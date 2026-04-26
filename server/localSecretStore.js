import fs from "node:fs";
import path from "node:path";

const DEFAULT_SECRET_FILE = ".tikpal/connector-secrets.json";

export function getDefaultSecretStorePath(cwd = process.cwd()) {
  return path.join(cwd, DEFAULT_SECRET_FILE);
}

export function createJsonFileSecretStore(filePath = process.env.TIKPAL_SECRET_FILE || getDefaultSecretStorePath()) {
  const resolvedPath = path.resolve(filePath);

  function readAll() {
    try {
      if (!fs.existsSync(resolvedPath)) {
        return {};
      }

      const raw = fs.readFileSync(resolvedPath, "utf8").trim();
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn(`Failed to read tikpal secret file ${resolvedPath}: ${error.message}`);
      return {};
    }
  }

  function writeAll(secrets) {
    try {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true, mode: 0o700 });
      const temporaryPath = `${resolvedPath}.${process.pid}.tmp`;
      fs.writeFileSync(temporaryPath, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(temporaryPath, resolvedPath);
      fs.chmodSync(resolvedPath, 0o600);
    } catch (error) {
      console.warn(`Failed to write tikpal secret file ${resolvedPath}: ${error.message}`);
    }
  }

  return {
    filePath: resolvedPath,
    get(name) {
      return readAll()[name] ?? null;
    },
    set(name, value) {
      const secrets = readAll();
      secrets[name] = {
        ...(value ?? {}),
        updatedAt: new Date().toISOString(),
      };
      writeAll(secrets);
    },
    delete(name) {
      const secrets = readAll();
      delete secrets[name];
      writeAll(secrets);
    },
  };
}
