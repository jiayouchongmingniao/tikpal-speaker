import fs from "node:fs";
import { summarizePerformanceTrace } from "../src/viewmodels/performance.js";

function readTrace(filePath) {
  if (!filePath) {
    return {
      items: [
        { avgFps: 58, interactionLatencyMs: 24, memoryUsageMb: 72, activeMode: "flow" },
        { avgFps: 31, interactionLatencyMs: 42, memoryUsageMb: 84, activeMode: "flow" },
        { avgFps: 27, interactionLatencyMs: 54, memoryUsageMb: 89, activeMode: "flow" },
        { avgFps: 22, interactionLatencyMs: 92, memoryUsageMb: 96, activeMode: "flow" },
      ],
    };
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const tracePath = process.argv[2] ?? null;
const payload = readTrace(tracePath);
const samples = Array.isArray(payload) ? payload : payload.items ?? [];
const summary = summarizePerformanceTrace(samples);

console.log(JSON.stringify(summary, null, 2));
