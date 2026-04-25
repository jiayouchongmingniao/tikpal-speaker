import assert from "node:assert/strict";
import { createSystemStateStore } from "../server/systemStateStore.js";
import { startServer } from "../server/index.js";

const API_KEY = "test-api-key";

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

async function requestJson(url, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return {
    status: response.status,
    json: await response.json(),
  };
}

async function postAction(baseUrl, body, headers = {}) {
  return requestJson(`${baseUrl}/api/v1/system/actions`, {
    method: "POST",
    body,
    headers,
  });
}

async function patchJson(url, body, headers = {}) {
  return requestJson(url, {
    method: "PATCH",
    body,
    headers,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const store = createSystemStateStore();
const server = await startServer({
  port: 0,
  host: "127.0.0.1",
  store,
  apiKey: API_KEY,
});

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  await test("api descriptor exposes portable-facing endpoint links", async () => {
    const response = await requestJson(`${baseUrl}/api/v1/system`);

    assert.equal(response.status, 200);
    assert.equal(response.json.service, "tikpal-speaker-system-api");
    assert.equal(response.json.endpoints.bootstrap, "/api/v1/system/portable/bootstrap");
    assert.equal(response.json.endpoints.currentSession, "/api/v1/system/controller-sessions/current");
    assert.equal(response.json.endpoints.otaApply, "/api/v1/system/ota/apply");
    assert.equal(response.json.endpoints.otaRollback, "/api/v1/system/ota/rollback");
  });

  await test("applied response includes structured ActionResponse fields", async () => {
    const requestId = "req_applied";
    const timestamp = "2026-04-21T14:00:00Z";
    const response = await postAction(
      baseUrl,
      {
        type: "focus_panel",
        payload: { panel: "screen" },
        source: "remote",
        requestId,
        timestamp,
      },
      { "X-Tikpal-Key": API_KEY },
    );

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.result, "applied");
    assert.equal(response.json.state.activeMode, "overview");
    assert.equal(response.json.state.focusedPanel, "screen");
    assert.equal(response.json.appliedAction.type, "focus_panel");
    assert.equal(response.json.appliedAction.requestId, requestId);
    assert.equal(response.json.appliedAction.timestamp, timestamp);
  });

  await test("runtime endpoints expose summary, action log, and state transitions", async () => {
    const authHeaders = { "X-Tikpal-Key": API_KEY };
    const runtimeSummaryResponse = await requestJson(`${baseUrl}/api/v1/system/runtime/summary`, {
      headers: authHeaders,
    });
    assert.equal(runtimeSummaryResponse.status, 200);
    assert.equal(runtimeSummaryResponse.json.focusedPanel, "screen");
    assert.equal(typeof runtimeSummaryResponse.json.activeMode, "string");

    const actionLogResponse = await requestJson(`${baseUrl}/api/v1/system/runtime/action-log?limit=5`, {
      headers: authHeaders,
    });
    assert.equal(actionLogResponse.status, 200);
    assert.equal(Array.isArray(actionLogResponse.json.items), true);
    assert.equal(actionLogResponse.json.items[0].actionType, "focus_panel");
    assert.equal(actionLogResponse.json.items[0].result, "applied");

    const transitionsResponse = await requestJson(`${baseUrl}/api/v1/system/runtime/state-transitions?limit=5`, {
      headers: authHeaders,
    });
    assert.equal(transitionsResponse.status, 200);
    assert.equal(Array.isArray(transitionsResponse.json.items), true);
    assert.equal(transitionsResponse.json.items[0].reasonAction, "focus_panel");
    assert.equal(transitionsResponse.json.items[0].to.focusedPanel, "screen");
  });

  await test("runtime performance actions update summary and logs", async () => {
    const authHeaders = { "X-Tikpal-Key": API_KEY };

    const setTierResponse = await postAction(
      baseUrl,
      {
        type: "runtime_set_performance_tier",
        payload: { tier: "reduced", reason: "manual" },
        source: "api",
        requestId: "runtime_set_perf_tier",
      },
      authHeaders,
    );
    assert.equal(setTierResponse.status, 200);
    assert.equal(setTierResponse.json.state.system.performanceTier, "reduced");

    const reportResponse = await postAction(
      baseUrl,
      {
        type: "runtime_report_performance",
        payload: { avgFps: 22, reason: "fps" },
        source: "api",
        requestId: "runtime_report_perf",
      },
      authHeaders,
    );
    assert.equal(reportResponse.status, 200);
    assert.equal(reportResponse.json.state.system.performanceTier, "safe");

    const runtimeSummaryResponse = await requestJson(`${baseUrl}/api/v1/system/runtime/summary`, {
      headers: authHeaders,
    });
    assert.equal(runtimeSummaryResponse.status, 200);
    assert.equal(runtimeSummaryResponse.json.performanceTier, "safe");
    assert.equal(runtimeSummaryResponse.json.avgFps, 22);
    assert.equal(runtimeSummaryResponse.json.lastDegradeReason, "fps");
  });

  await test("ota check, apply, and rollback expose a verifiable update lifecycle", async () => {
    const authHeaders = { "X-Tikpal-Key": API_KEY };

    const statusBeforeResponse = await requestJson(`${baseUrl}/api/v1/system/ota/status`, {
      headers: authHeaders,
    });
    assert.equal(statusBeforeResponse.status, 200);
    assert.equal(statusBeforeResponse.json.currentVersion, "0.1.0");
    assert.equal(statusBeforeResponse.json.canRollback, false);

    const checkResponse = await requestJson(`${baseUrl}/api/v1/system/ota/check`, {
      method: "POST",
      headers: authHeaders,
      body: {
        targetVersion: "0.1.2",
        requestId: "ota_check_available",
      },
    });
    assert.equal(checkResponse.status, 200);
    assert.equal(checkResponse.json.state.system.otaStatus, "available");
    assert.equal(checkResponse.json.state.system.ota.targetVersion, "0.1.2");
    assert.equal(checkResponse.json.state.system.ota.updateAvailable, true);

    const applyResponse = await requestJson(`${baseUrl}/api/v1/system/ota/apply`, {
      method: "POST",
      headers: authHeaders,
      body: {
        requestId: "ota_apply_available",
      },
    });
    assert.equal(applyResponse.status, 200);
    assert.equal(applyResponse.json.state.system.version, "0.1.2");
    assert.equal(applyResponse.json.state.system.ota.currentVersion, "0.1.2");
    assert.equal(applyResponse.json.state.system.ota.previousVersion, "0.1.0");
    assert.equal(applyResponse.json.state.system.ota.canRollback, true);
    assert.deepEqual(applyResponse.json.state.system.ota.lastOperation.phases, [
      "downloading",
      "verifying",
      "applying",
      "restarting",
      "health_check",
      "completed",
    ]);

    const rollbackResponse = await requestJson(`${baseUrl}/api/v1/system/ota/rollback`, {
      method: "POST",
      headers: authHeaders,
      body: {
        requestId: "ota_rollback_available",
      },
    });
    assert.equal(rollbackResponse.status, 200);
    assert.equal(rollbackResponse.json.state.system.version, "0.1.0");
    assert.equal(rollbackResponse.json.state.system.ota.currentVersion, "0.1.0");
    assert.equal(rollbackResponse.json.state.system.ota.canRollback, false);
    assert.deepEqual(rollbackResponse.json.state.system.ota.lastOperation.phases, [
      "rollback",
      "restarting",
      "health_check",
      "completed",
    ]);
  });

  await test("admin connector management binds, refreshes, and revokes without exposing tokens", async () => {
    const authHeaders = { "X-Tikpal-Key": API_KEY };

    const anonymousListResponse = await requestJson(`${baseUrl}/api/v1/system/integrations`);
    assert.equal(anonymousListResponse.status, 403);

    const unboundRefreshResponse = await requestJson(`${baseUrl}/api/v1/system/integrations/todoist/refresh`, {
      method: "POST",
      headers: authHeaders,
      body: {
        delayMs: 20,
      },
    });
    assert.equal(unboundRefreshResponse.status, 409);
    assert.equal(unboundRefreshResponse.json.error.code, "CONNECTOR_NOT_BOUND");

    const connectResponse = await requestJson(`${baseUrl}/api/v1/system/integrations/calendar/connect`, {
      method: "POST",
      headers: authHeaders,
      body: {
        accountLabel: "calendar.user@example.com",
        accessToken: "secret-access-token",
        refreshToken: "secret-refresh-token",
      },
    });
    assert.equal(connectResponse.status, 200);
    assert.equal(connectResponse.json.integrations.calendar.connected, true);
    assert.equal(connectResponse.json.integrations.calendar.accountLabel, "calendar.user@example.com");
    assert.equal(connectResponse.json.integrations.calendar.credentialRef, "local:calendar:calendar.user@example.com");
    assert.equal(JSON.stringify(connectResponse.json).includes("secret-access-token"), false);

    const listResponse = await requestJson(`${baseUrl}/api/v1/system/integrations`, {
      headers: authHeaders,
    });
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.json.items.calendar.connected, true);
    assert.equal(listResponse.json.items.calendar.credentialRef, "local:calendar:calendar.user@example.com");

    const refreshResponse = await requestJson(`${baseUrl}/api/v1/system/integrations/calendar/refresh`, {
      method: "POST",
      headers: authHeaders,
      body: {
        scenario: "success",
        fixture: "default",
        delayMs: 20,
      },
    });
    assert.equal(refreshResponse.status, 202);
    assert.equal(refreshResponse.json.connector, "calendar");

    await sleep(40);

    const refreshedStateResponse = await requestJson(`${baseUrl}/api/v1/system/state`, {
      headers: authHeaders,
    });
    assert.equal(refreshedStateResponse.status, 200);
    assert.equal(refreshedStateResponse.json.integrations.calendar.status, "ok");
    assert.equal(refreshedStateResponse.json.integrations.calendar.currentEvent.title, "Deep Work Block");

    const disconnectResponse = await requestJson(`${baseUrl}/api/v1/system/integrations/calendar`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.equal(disconnectResponse.status, 200);
    assert.equal(disconnectResponse.json.integrations.calendar.connected, false);
    assert.equal(disconnectResponse.json.integrations.calendar.status, "revoked");
    assert.equal(disconnectResponse.json.integrations.calendar.credentialRef, null);
    assert.equal(disconnectResponse.json.integrations.calendar.currentEvent.title, "Deep Work Block");
  });

  await test("controller session can read state and execute controller actions", async () => {
    const createResponse = await requestJson(`${baseUrl}/api/v1/system/controller-sessions`, {
      method: "POST",
      headers: {
        "X-Tikpal-Key": API_KEY,
      },
      body: {
        deviceId: "portable-001",
        name: "Portable",
        role: "controller",
        capabilities: ["mode_switch", "playback"],
      },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.json.role, "controller");
    assert.ok(createResponse.json.token);

    const authHeader = { Authorization: `Bearer ${createResponse.json.token}` };
    const stateResponse = await requestJson(`${baseUrl}/api/v1/system/state`, {
      headers: authHeader,
    });
    assert.equal(stateResponse.status, 200);
    assert.equal(typeof stateResponse.json.activeMode, "string");

    const actionResponse = await postAction(
      baseUrl,
      {
        type: "set_mode",
        payload: { mode: "flow" },
        source: "portable_controller",
        requestId: "portable_set_mode",
      },
      authHeader,
    );

    assert.equal(actionResponse.status, 200);
    assert.equal(actionResponse.json.ok, true);
    assert.equal(actionResponse.json.state.activeMode, "flow");

    const sessionResponse = await requestJson(`${baseUrl}/api/v1/system/controller-sessions/${createResponse.json.id}`, {
      headers: authHeader,
    });
    assert.equal(sessionResponse.status, 200);
    assert.equal(sessionResponse.json.lastSeenAt !== null, true);

    const currentSessionResponse = await requestJson(`${baseUrl}/api/v1/system/controller-sessions/current`, {
      headers: authHeader,
    });
    assert.equal(currentSessionResponse.status, 200);
    assert.equal(currentSessionResponse.json.id, createResponse.json.id);

    const bootstrapResponse = await requestJson(`${baseUrl}/api/v1/system/portable/bootstrap`, {
      headers: authHeader,
    });
    assert.equal(bootstrapResponse.status, 200);
    assert.equal(bootstrapResponse.json.ok, true);
    assert.equal(bootstrapResponse.json.session.id, createResponse.json.id);
    assert.equal(Array.isArray(bootstrapResponse.json.capabilities.modes), true);
    assert.equal(typeof bootstrapResponse.json.state.activeMode, "string");
    assert.equal(typeof bootstrapResponse.json.screenContext.focusItem.title, "string");

    const screenContextResponse = await requestJson(`${baseUrl}/api/v1/system/screen/context`, {
      headers: authHeader,
    });
    assert.equal(screenContextResponse.status, 200);
    assert.equal(typeof screenContextResponse.json.now, "string");
    assert.equal(typeof screenContextResponse.json.pomodoro.remainingSec, "number");
  });

  await test("mock connector patches update screen context mapping", async () => {
    const authHeaders = { "X-Tikpal-Key": API_KEY };
    const calendarPatch = await patchJson(`${baseUrl}/api/v1/system/integrations/calendar`, {
      connected: true,
      status: "ok",
      currentEvent: {
        id: "cal_current",
        title: "Deep Work Block",
        startsAt: "2026-04-21T09:00:00Z",
        endsAt: "2026-04-21T10:00:00Z",
      },
      nextEvent: {
        id: "cal_next",
        title: "Review notes",
        startsAt: "2026-04-21T10:30:00Z",
      },
      remainingEvents: 2,
    }, authHeaders);

    assert.equal(calendarPatch.status, 200);

    const todoistPatch = await patchJson(`${baseUrl}/api/v1/system/integrations/todoist`, {
      connected: true,
      status: "ok",
      currentTask: {
        id: "todo_current",
        title: "Write Spec",
      },
      nextTask: {
        id: "todo_next",
        title: "Refine roadmap",
      },
      remainingTasks: 6,
    }, authHeaders);

    assert.equal(todoistPatch.status, 200);

    const screenContextResponse = await requestJson(`${baseUrl}/api/v1/system/screen/context`, {
      headers: authHeaders,
    });

    assert.equal(screenContextResponse.status, 200);
    assert.equal(screenContextResponse.json.focusItem.title, "Write Ambient OS Spec");
    assert.equal(screenContextResponse.json.currentBlock.title, "Deep Work Block");
    assert.equal(screenContextResponse.json.nextBlock.title, "Review notes");
    assert.equal(screenContextResponse.json.todaySummary.remainingTasks, 6);
    assert.equal(screenContextResponse.json.todaySummary.remainingEvents, 2);
  });

  await test("screen_set_focus_item updates manual focus in state and ScreenContext", async () => {
    const authHeaders = { "X-Tikpal-Key": API_KEY };
    const actionResponse = await postAction(
      baseUrl,
      {
        type: "screen_set_focus_item",
        payload: { title: "Manual focus override" },
        source: "api",
        requestId: "screen_set_focus_item_manual",
      },
      authHeaders,
    );

    assert.equal(actionResponse.status, 200);
    assert.equal(actionResponse.json.ok, true);
    assert.equal(actionResponse.json.state.screen.currentTask, "Manual focus override");

    const screenContextResponse = await requestJson(`${baseUrl}/api/v1/system/screen/context`, {
      headers: authHeaders,
    });
    assert.equal(screenContextResponse.status, 200);
    assert.equal(screenContextResponse.json.focusItem.title, "Manual focus override");
    assert.equal(screenContextResponse.json.focusItem.source, "manual");
  });

  await test("mock connector sync worker exposes syncing to ok lifecycle", async () => {
    const authHeaders = { "X-Tikpal-Key": API_KEY };

    const syncStartResponse = await requestJson(`${baseUrl}/api/v1/system/integrations/calendar/sync`, {
      method: "POST",
      headers: authHeaders,
      body: {
        scenario: "success",
        delayMs: 20,
      },
    });

    assert.equal(syncStartResponse.status, 202);
    assert.equal(syncStartResponse.json.connector, "calendar");
    assert.equal(syncStartResponse.json.status, "syncing");

    const syncingStateResponse = await requestJson(`${baseUrl}/api/v1/system/state`, {
      headers: authHeaders,
    });
    assert.equal(syncingStateResponse.status, 200);
    assert.equal(syncingStateResponse.json.integrations.calendar.status, "syncing");

    await sleep(40);

    const jobResponse = await requestJson(
      `${baseUrl}/api/v1/system/integrations/calendar/sync-jobs/${syncStartResponse.json.id}`,
      {
        headers: authHeaders,
      },
    );
    assert.equal(jobResponse.status, 200);
    assert.equal(jobResponse.json.status, "ok");
    assert.equal(jobResponse.json.finishedAt !== null, true);

    const screenContextResponse = await requestJson(`${baseUrl}/api/v1/system/screen/context`, {
      headers: authHeaders,
    });
    assert.equal(screenContextResponse.status, 200);
    assert.equal(screenContextResponse.json.currentBlock.title, "Deep Work Block");
    assert.equal(screenContextResponse.json.sync.calendarStatus, "ok");
  });

  await test("mock connector sync worker marks stale context without dropping last good data", async () => {
    const authHeaders = { "X-Tikpal-Key": API_KEY };

    const syncStartResponse = await requestJson(`${baseUrl}/api/v1/system/integrations/todoist/sync`, {
      method: "POST",
      headers: authHeaders,
      body: {
        scenario: "stale",
        delayMs: 20,
      },
    });

    assert.equal(syncStartResponse.status, 202);
    assert.equal(syncStartResponse.json.connector, "todoist");
    assert.equal(syncStartResponse.json.status, "syncing");

    await sleep(40);

    const jobResponse = await requestJson(
      `${baseUrl}/api/v1/system/integrations/todoist/sync-jobs/${syncStartResponse.json.id}`,
      {
        headers: authHeaders,
      },
    );
    assert.equal(jobResponse.status, 200);
    assert.equal(jobResponse.json.status, "stale");

    const screenContextResponse = await requestJson(`${baseUrl}/api/v1/system/screen/context`, {
      headers: authHeaders,
    });
    assert.equal(screenContextResponse.status, 200);
    assert.equal(screenContextResponse.json.focusItem.title, "Manual focus override");
    assert.equal(screenContextResponse.json.focusItem.source, "manual");
    assert.equal(screenContextResponse.json.todaySummary.remainingTasks, 6);
    assert.equal(screenContextResponse.json.sync.todoistStatus, "stale");
    assert.equal(screenContextResponse.json.sync.stale, true);
  });

  await test("mock connector sync worker surfaces error while preserving previous connector snapshot", async () => {
    const authHeaders = { "X-Tikpal-Key": API_KEY };

    const syncStartResponse = await requestJson(`${baseUrl}/api/v1/system/integrations/calendar/sync`, {
      method: "POST",
      headers: authHeaders,
      body: {
        scenario: "error",
        delayMs: 20,
      },
    });

    assert.equal(syncStartResponse.status, 202);
    assert.equal(syncStartResponse.json.connector, "calendar");

    await sleep(40);

    const jobResponse = await requestJson(
      `${baseUrl}/api/v1/system/integrations/calendar/sync-jobs/${syncStartResponse.json.id}`,
      {
        headers: authHeaders,
      },
    );
    assert.equal(jobResponse.status, 200);
    assert.equal(jobResponse.json.status, "error");

    const stateResponse = await requestJson(`${baseUrl}/api/v1/system/state`, {
      headers: authHeaders,
    });
    assert.equal(stateResponse.status, 200);
    assert.equal(stateResponse.json.integrations.calendar.status, "error");
    assert.equal(stateResponse.json.integrations.calendar.lastErrorCode, "CALENDAR_SYNC_FAILED");
    assert.equal(stateResponse.json.integrations.calendar.currentEvent.title, "Deep Work Block");

    const screenContextResponse = await requestJson(`${baseUrl}/api/v1/system/screen/context`, {
      headers: authHeaders,
    });
    assert.equal(screenContextResponse.status, 200);
    assert.equal(screenContextResponse.json.currentBlock.title, "Deep Work Block");
    assert.equal(screenContextResponse.json.sync.calendarStatus, "error");
  });

  await test("mock connector fixtures can be listed and applied through sync jobs", async () => {
    const authHeaders = { "X-Tikpal-Key": API_KEY };

    const fixturesResponse = await requestJson(`${baseUrl}/api/v1/system/integrations/todoist/fixtures`, {
      headers: authHeaders,
    });
    assert.equal(fixturesResponse.status, 200);
    assert.equal(fixturesResponse.json.connector, "todoist");
    assert.equal(fixturesResponse.json.fixtures.includes("writing_day"), true);

    const syncStartResponse = await requestJson(`${baseUrl}/api/v1/system/integrations/todoist/sync`, {
      method: "POST",
      headers: authHeaders,
      body: {
        scenario: "success",
        fixture: "writing_day",
        delayMs: 20,
      },
    });
    assert.equal(syncStartResponse.status, 202);
    assert.equal(syncStartResponse.json.fixture, "writing_day");

    await sleep(40);

    const jobResponse = await requestJson(
      `${baseUrl}/api/v1/system/integrations/todoist/sync-jobs/${syncStartResponse.json.id}`,
      {
        headers: authHeaders,
      },
    );
    assert.equal(jobResponse.status, 200);
    assert.equal(jobResponse.json.fixture, "writing_day");
    assert.equal(jobResponse.json.status, "ok");

    const screenContextResponse = await requestJson(`${baseUrl}/api/v1/system/screen/context`, {
      headers: authHeaders,
    });
    assert.equal(screenContextResponse.status, 200);
    assert.equal(screenContextResponse.json.todaySummary.remainingTasks, 4);
  });

  await test("ignored response preserves structured ActionResponse fields", async () => {
    const requestId = "req_ignored";
    const response = await postAction(
      baseUrl,
      {
        type: "show_controls",
        payload: { reason: "touch" },
        source: "touch",
        requestId,
        timestamp: "2026-04-21T14:00:01Z",
      },
      { "X-Tikpal-Key": API_KEY },
    );

    assert.equal(response.status, 200);
    assert.equal(response.json.result, "applied");

    const secondResponse = await postAction(
      baseUrl,
      {
        type: "show_controls",
        payload: { reason: "touch" },
        source: "touch",
        requestId: "req_ignored_repeat",
        timestamp: "2026-04-21T14:00:02Z",
      },
      { "X-Tikpal-Key": API_KEY },
    );

    assert.equal(secondResponse.status, 200);
    assert.equal(secondResponse.json.ok, true);
    assert.equal(secondResponse.json.result, "ignored");
    assert.equal(secondResponse.json.state.overlay.visible, true);
    assert.equal(secondResponse.json.appliedAction.type, "show_controls");
  });

  await test("rejected invalid payload returns structured 400 ActionResponse", async () => {
    const requestId = "req_rejected";
    const response = await postAction(
      baseUrl,
      {
        type: "focus_panel",
        payload: { panel: "invalid-panel" },
        source: "api",
        requestId,
        timestamp: "2026-04-21T14:00:03Z",
      },
      { "X-Tikpal-Key": API_KEY },
    );

    assert.equal(response.status, 400);
    assert.equal(response.json.ok, false);
    assert.equal(response.json.result, "rejected");
    assert.equal(response.json.state, null);
    assert.equal(response.json.error.code, "INVALID_PANEL");
    assert.equal(response.json.appliedAction.requestId, requestId);
  });

  await test("viewer session cannot execute controller actions", async () => {
    const createResponse = await requestJson(`${baseUrl}/api/v1/system/controller-sessions`, {
      method: "POST",
      headers: {
        "X-Tikpal-Key": API_KEY,
      },
      body: {
        deviceId: "viewer-001",
        name: "Viewer",
        role: "viewer",
      },
    });

    assert.equal(createResponse.status, 201);
    const actionResponse = await postAction(
      baseUrl,
      {
        type: "set_mode",
        payload: { mode: "screen" },
        source: "portable_controller",
        requestId: "viewer_denied",
      },
      {
        Authorization: `Bearer ${createResponse.json.token}`,
      },
    );

    assert.equal(actionResponse.status, 403);
    assert.equal(actionResponse.json.ok, false);
    assert.equal(actionResponse.json.result, "rejected");
    assert.equal(actionResponse.json.error.code, "FORBIDDEN");
  });

  await test("pairing code can mint a controller session and cannot be reused", async () => {
    const pairingResponse = await requestJson(`${baseUrl}/api/v1/system/pairing-codes`, {
      method: "POST",
      headers: {
        "X-Tikpal-Key": API_KEY,
      },
      body: {
        role: "controller",
        capabilities: ["mode_switch", "playback"],
      },
    });

    assert.equal(pairingResponse.status, 201);
    assert.equal(typeof pairingResponse.json.code, "string");

    const claimResponse = await requestJson(`${baseUrl}/api/v1/system/pairing-codes/claim`, {
      method: "POST",
      body: {
        code: pairingResponse.json.code,
        deviceId: "pairing-device-001",
        name: "Pairing Device",
      },
    });

    assert.equal(claimResponse.status, 201);
    assert.equal(claimResponse.json.role, "controller");
    assert.ok(claimResponse.json.token);

    const reuseResponse = await requestJson(`${baseUrl}/api/v1/system/pairing-codes/claim`, {
      method: "POST",
      body: {
        code: pairingResponse.json.code,
        deviceId: "pairing-device-002",
      },
    });

    assert.equal(reuseResponse.status, 400);
    assert.equal(reuseResponse.json.ok, false);
    assert.equal(reuseResponse.json.result, "rejected");
    assert.equal(reuseResponse.json.error.code, "PAIRING_CODE_INVALID");
  });

  await test("expired pairing code is rejected", async () => {
    const pairingResponse = await requestJson(`${baseUrl}/api/v1/system/pairing-codes`, {
      method: "POST",
      headers: {
        "X-Tikpal-Key": API_KEY,
      },
      body: {
        ttlSec: 0,
      },
    });

    assert.equal(pairingResponse.status, 201);
    const expiredClaimResponse = await requestJson(`${baseUrl}/api/v1/system/pairing-codes/claim`, {
      method: "POST",
      body: {
        code: pairingResponse.json.code,
        deviceId: "expired-pairing-device",
      },
    });

    assert.equal(expiredClaimResponse.status, 400);
    assert.equal(expiredClaimResponse.json.ok, false);
    assert.equal(expiredClaimResponse.json.result, "rejected");
    assert.equal(expiredClaimResponse.json.error.code, "PAIRING_CODE_INVALID");
  });

  await test("expired controller session is rejected across bootstrap and actions", async () => {
    const createResponse = await requestJson(`${baseUrl}/api/v1/system/controller-sessions`, {
      method: "POST",
      headers: {
        "X-Tikpal-Key": API_KEY,
      },
      body: {
        deviceId: "expired-001",
        name: "Expired",
        role: "controller",
        ttlSec: 0,
      },
    });

    assert.equal(createResponse.status, 201);
    const authHeader = {
      Authorization: `Bearer ${createResponse.json.token}`,
    };

    const bootstrapResponse = await requestJson(`${baseUrl}/api/v1/system/portable/bootstrap`, {
      headers: authHeader,
    });
    assert.equal(bootstrapResponse.status, 401);
    assert.equal(bootstrapResponse.json.ok, false);
    assert.equal(bootstrapResponse.json.error.code, "SESSION_INVALID");

    const currentSessionResponse = await requestJson(`${baseUrl}/api/v1/system/controller-sessions/current`, {
      headers: authHeader,
    });
    assert.equal(currentSessionResponse.status, 401);
    assert.equal(currentSessionResponse.json.error.code, "SESSION_INVALID");

    const actionResponse = await postAction(
      baseUrl,
      {
        type: "toggle_play",
        payload: {},
        source: "portable_controller",
        requestId: "expired_toggle_play",
      },
      authHeader,
    );
    assert.equal(actionResponse.status, 401);
    assert.equal(actionResponse.json.ok, false);
    assert.equal(actionResponse.json.result, "rejected");
    assert.equal(actionResponse.json.error.code, "SESSION_INVALID");
  });

  await test("revoked controller session cannot be reused after delete", async () => {
    const createResponse = await requestJson(`${baseUrl}/api/v1/system/controller-sessions`, {
      method: "POST",
      headers: {
        "X-Tikpal-Key": API_KEY,
      },
      body: {
        deviceId: "revoked-001",
        name: "Revoked",
        role: "controller",
      },
    });

    assert.equal(createResponse.status, 201);
    const authHeader = {
      Authorization: `Bearer ${createResponse.json.token}`,
    };

    const deleteResponse = await requestJson(`${baseUrl}/api/v1/system/controller-sessions/${createResponse.json.id}`, {
      method: "DELETE",
      headers: authHeader,
    });
    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteResponse.json.ok, true);

    const bootstrapResponse = await requestJson(`${baseUrl}/api/v1/system/portable/bootstrap`, {
      headers: authHeader,
    });
    assert.equal(bootstrapResponse.status, 401);
    assert.equal(bootstrapResponse.json.error.code, "SESSION_INVALID");

    const stateResponse = await requestJson(`${baseUrl}/api/v1/system/state`, {
      headers: authHeader,
    });
    assert.equal(stateResponse.status, 401);
    assert.equal(stateResponse.json.error.code, "SESSION_INVALID");
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
