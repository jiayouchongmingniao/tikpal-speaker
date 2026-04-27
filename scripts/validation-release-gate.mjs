import { spawn } from "node:child_process";

const STEPS = [
  ["npm", ["run", "test:performance"]],
  ["npm", ["run", "test:http-smoke"]],
  ["npm", ["run", "build"]],
];

function run(command, args) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("close", (code) => {
      resolve({
        command: [command, ...args].join(" "),
        code,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

const results = [];
for (const [command, args] of STEPS) {
  console.log(`\n==> ${[command, ...args].join(" ")}`);
  const result = await run(command, args);
  results.push(result);
  if (result.code !== 0) {
    console.error(`\nRelease gate failed at: ${result.command}`);
    process.exit(result.code ?? 1);
  }
}

console.log("\nRelease gate passed.");
for (const result of results) {
  console.log(`- ${result.command}: ${result.durationMs}ms`);
}
