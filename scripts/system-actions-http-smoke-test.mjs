import assert from "node:assert/strict";
import { createSystemStateStore } from "../server/systemStateStore.js";
import { startServer } from "../server/index.js";

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

async function postJson(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/v1/system/actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    json: await response.json(),
  };
}

const store = createSystemStateStore();
const server = await startServer({
  port: 0,
  host: "127.0.0.1",
  store,
});

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  await test("applied response includes structured ActionResponse fields", async () => {
    const requestId = "req_applied";
    const timestamp = "2026-04-21T14:00:00Z";
    const response = await postJson(baseUrl, {
      type: "focus_panel",
      payload: { panel: "screen" },
      source: "remote",
      requestId,
      timestamp,
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.result, "applied");
    assert.equal(response.json.state.activeMode, "overview");
    assert.equal(response.json.state.focusedPanel, "screen");
    assert.equal(response.json.appliedAction.type, "focus_panel");
    assert.equal(response.json.appliedAction.requestId, requestId);
    assert.equal(response.json.appliedAction.timestamp, timestamp);
  });

  await test("ignored response preserves structured ActionResponse fields", async () => {
    const requestId = "req_ignored";
    const response = await postJson(baseUrl, {
      type: "show_controls",
      payload: { reason: "touch" },
      source: "touch",
      requestId,
      timestamp: "2026-04-21T14:00:01Z",
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.result, "applied");

    const secondResponse = await postJson(baseUrl, {
      type: "show_controls",
      payload: { reason: "touch" },
      source: "touch",
      requestId: "req_ignored_repeat",
      timestamp: "2026-04-21T14:00:02Z",
    });

    assert.equal(secondResponse.status, 200);
    assert.equal(secondResponse.json.ok, true);
    assert.equal(secondResponse.json.result, "ignored");
    assert.equal(secondResponse.json.state.overlay.visible, true);
    assert.equal(secondResponse.json.appliedAction.type, "show_controls");
  });

  await test("rejected invalid action returns structured 400 ActionResponse", async () => {
    const requestId = "req_rejected";
    const response = await postJson(baseUrl, {
      type: "set_mode",
      payload: { mode: "invalid-mode" },
      source: "api",
      requestId,
      timestamp: "2026-04-21T14:00:03Z",
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);
    assert.equal(response.json.result, "rejected");
    assert.equal(response.json.state, null);
    assert.equal(response.json.error.code, "INVALID_MODE");
    assert.equal(response.json.appliedAction.requestId, requestId);
  });
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

console.log("HTTP smoke tests passed.");
