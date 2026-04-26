import fs from "node:fs";
import path from "node:path";

const DEFAULT_STATE_FILE = ".tikpal/system-state.json";

export function getDefaultPersistencePath(cwd = process.cwd()) {
  return path.join(cwd, DEFAULT_STATE_FILE);
}

export function createJsonFilePersistence(filePath = process.env.TIKPAL_STATE_FILE || getDefaultPersistencePath()) {
  const resolvedPath = path.resolve(filePath);

  return {
    filePath: resolvedPath,
    read() {
      try {
        if (!fs.existsSync(resolvedPath)) {
          return null;
        }

        const raw = fs.readFileSync(resolvedPath, "utf8").trim();
        if (!raw) {
          return null;
        }

        return JSON.parse(raw);
      } catch (error) {
        console.warn(`Failed to read tikpal persistence file ${resolvedPath}: ${error.message}`);
        return null;
      }
    },
    write(snapshot) {
      try {
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        const temporaryPath = `${resolvedPath}.${process.pid}.tmp`;
        fs.writeFileSync(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`);
        fs.renameSync(temporaryPath, resolvedPath);
      } catch (error) {
        console.warn(`Failed to write tikpal persistence file ${resolvedPath}: ${error.message}`);
      }
    },
  };
}
