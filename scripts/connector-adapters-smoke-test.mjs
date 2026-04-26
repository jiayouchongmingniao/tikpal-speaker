import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createConnectorAdapterRegistry, createRealConnectorAdapter } from "../server/connectorAdapters.js";
import { createJsonFileSecretStore } from "../server/localSecretStore.js";
import { createMockConnectorSyncService } from "../server/mockConnectorSyncService.js";
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await test("fixture connector adapter preserves current mock sync behavior", async () => {
  const registry = createConnectorAdapterRegistry();
  assert.equal(registry.listFixtures("calendar").includes("meeting_heavy"), true);

  const patch = await registry.sync("todoist", {
    scenario: "success",
    fixture: "writing_day",
  });
  assert.equal(patch.status, "ok");
  assert.equal(patch.currentTask.title, "Draft chapter outline");
});

await test("sync service can run a custom adapter behind the same ScreenContext contract", async () => {
  const store = createSystemStateStore();
  const registry = createConnectorAdapterRegistry({
    calendar: {
      name: "calendar",
      mode: "custom-test",
      listFixtures() {
        return ["custom_day"];
      },
      async sync() {
        return {
          connected: true,
          status: "ok",
          accountLabel: "calendar.realistic@tikpal.local",
          lastSyncAt: "2026-04-26T12:00:00.000Z",
          lastErrorCode: null,
          lastErrorMessage: null,
          currentEvent: {
            id: "realistic_current",
            title: "Real adapter focus block",
            startsAt: "2026-04-26T12:00:00.000Z",
            endsAt: "2026-04-26T13:00:00.000Z",
          },
          nextEvent: {
            id: "realistic_next",
            title: "Real adapter review",
            startsAt: "2026-04-26T13:30:00.000Z",
          },
          remainingEvents: 2,
        };
      },
    },
  });
  const syncService = createMockConnectorSyncService(store, { adapterRegistry: registry });

  assert.deepEqual(syncService.listFixtures("calendar"), ["custom_day"]);

  const job = syncService.runSync("calendar", { delayMs: 0 });
  await sleep(20);

  assert.equal(syncService.getJob(job.id).status, "ok");
  const context = createScreenContext(store.getSnapshot());
  assert.equal(context.currentBlock.title, "Real adapter focus block");
  assert.equal(context.nextBlock.title, "Real adapter review");
  assert.equal(context.sync.calendarStatus, "ok");
});

await test("adapter errors become connector error state without dropping last good snapshot", async () => {
  const store = createSystemStateStore();
  const registry = createConnectorAdapterRegistry({
    todoist: {
      name: "todoist",
      mode: "custom-test",
      async sync() {
        const error = new Error("Todoist token refresh failed");
        error.code = "TODOIST_TOKEN_REFRESH_FAILED";
        throw error;
      },
    },
  });
  const syncService = createMockConnectorSyncService(store, { adapterRegistry: registry });

  store.patchIntegration(
    "todoist",
    {
      connected: true,
      status: "ok",
      currentTask: {
        id: "last_good_task",
        title: "Last good task",
      },
      nextTask: {
        id: "last_good_next",
        title: "Last good next",
      },
      remainingTasks: 3,
    },
    "test",
  );

  const job = syncService.runSync("todoist", { delayMs: 0 });
  await sleep(20);

  assert.equal(syncService.getJob(job.id).status, "error");
  assert.equal(syncService.getJob(job.id).errorCode, "TODOIST_TOKEN_REFRESH_FAILED");
  assert.equal(store.getSnapshot().integrations.todoist.status, "error");
  assert.equal(store.getSnapshot().integrations.todoist.currentTask.title, "Last good task");

  const context = createScreenContext(store.getSnapshot());
  assert.equal(context.todaySummary.remainingTasks, 3);
  assert.equal(context.sync.todoistStatus, "error");
});

await test("real calendar adapter maps provider events without exposing UI to provider schema", async () => {
  const adapter = createRealConnectorAdapter("calendar", {
    credentials: {
      credentialRef: "runtime:calendar:test",
      accountLabel: "calendar.real@example.com",
      accessToken: "runtime-access-token",
      tokenExpiresAt: "2999-01-01T00:00:00.000Z",
    },
    config: {
      baseUrl: "https://calendar.example.test",
      calendarId: "primary",
      timeoutMs: 100,
    },
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.Authorization, "Bearer runtime-access-token");
      assert.equal(String(url).startsWith("https://calendar.example.test/calendars/primary/events"), true);
      return {
        ok: true,
        async json() {
          return {
            items: [
              {
                id: "cal_real_current",
                summary: "Real calendar focus",
                start: { dateTime: "2026-04-26T12:00:00.000Z" },
                end: { dateTime: "2026-04-26T13:00:00.000Z" },
              },
              {
                id: "cal_real_next",
                summary: "Real calendar review",
                start: { dateTime: "2026-04-26T13:30:00.000Z" },
              },
            ],
          };
        },
      };
    },
  });

  const patch = await adapter.sync();
  assert.equal(patch.status, "ok");
  assert.equal(patch.accountLabel, "calendar.real@example.com");
  assert.equal(patch.currentEvent.title, "Real calendar focus");
  assert.equal(patch.nextEvent.title, "Real calendar review");
  assert.equal(patch.remainingEvents, 2);
});

await test("real todoist adapter maps provider tasks and supports timeout errors", async () => {
  const adapter = createRealConnectorAdapter("todoist", {
    credentials: {
      credentialRef: "runtime:todoist:test",
      accountLabel: "todoist.real@example.com",
      accessToken: "runtime-todoist-token",
      tokenExpiresAt: "2999-01-01T00:00:00.000Z",
    },
    config: {
      baseUrl: "https://todoist.example.test",
      timeoutMs: 100,
      filter: "today",
    },
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.Authorization, "Bearer runtime-todoist-token");
      assert.equal(String(url), "https://todoist.example.test/tasks?filter=today");
      return {
        ok: true,
        async json() {
          return [
            {
              id: "todo_real_current",
              content: "Real Todoist focus",
              priority: 4,
              due: { datetime: "2026-04-26T12:00:00.000Z" },
            },
            {
              id: "todo_real_next",
              content: "Real Todoist next",
              due: { date: "2026-04-26" },
            },
          ];
        },
      };
    },
  });

  const patch = await adapter.sync();
  assert.equal(patch.status, "ok");
  assert.equal(patch.currentTask.title, "Real Todoist focus");
  assert.equal(patch.nextTask.title, "Real Todoist next");
  assert.equal(patch.remainingTasks, 2);

  const timeoutAdapter = createRealConnectorAdapter("todoist", {
    credentials: {
      credentialRef: "runtime:todoist:timeout",
      accessToken: "runtime-todoist-token",
    },
    config: {
      baseUrl: "https://todoist.example.test",
      timeoutMs: 1,
    },
    fetchImpl: (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
  });

  await assert.rejects(() => timeoutAdapter.sync(), /timed out/);
});

await test("real adapter rejects missing or expired runtime credentials clearly", async () => {
  await assert.rejects(
    () => createRealConnectorAdapter("calendar", { credentials: null }).sync(),
    /calendar connector is not bound/,
  );

  await assert.rejects(
    () =>
      createRealConnectorAdapter("todoist", {
        credentials: {
          credentialRef: "runtime:todoist:expired",
          accessToken: "runtime-token",
          tokenExpiresAt: "2000-01-01T00:00:00.000Z",
        },
      }).sync(),
    /token is expired/,
  );
});

await test("real adapter registry can read runtime secrets from the store", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tikpal-connectors-"));
  try {
    const store = createSystemStateStore({
      secretStore: createJsonFileSecretStore(path.join(tempDir, "secrets.json")),
    });
    store.bindIntegration(
      "todoist",
      {
        accountLabel: "todoist.secret@example.com",
        accessToken: "secret-store-token",
        tokenExpiresAt: "2999-01-01T00:00:00.000Z",
      },
      "admin_client",
    );
    const registry = createConnectorAdapterRegistry(
      {},
      {
        store,
        env: {
          TIKPAL_TODOIST_CONNECTOR_MODE: "real",
          TIKPAL_TODOIST_API_BASE: "https://todoist.secret.test",
          TIKPAL_TODOIST_TIMEOUT_MS: "100",
        },
        fetchImpl: async (_url, options) => {
          assert.equal(options.headers.Authorization, "Bearer secret-store-token");
          return {
            ok: true,
            async json() {
              return [
                {
                  id: "todo_secret_current",
                  content: "Secret-backed Todoist task",
                },
              ];
            },
          };
        },
      },
    );

    const patch = await registry.sync("todoist");
    assert.equal(patch.status, "ok");
    assert.equal(patch.accountLabel, "todoist.secret@example.com");
    assert.equal(patch.currentTask.title, "Secret-backed Todoist task");
    assert.equal(registry.get("calendar").mode, "fixture");
    assert.equal(registry.get("todoist").mode, "real");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

console.log("Connector adapter smoke tests passed.");
