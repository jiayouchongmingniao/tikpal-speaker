import { getConnectorFixture, listConnectorFixtures } from "./mockConnectorFixtures.js";

function nowIso() {
  return new Date().toISOString();
}

function createSuccessPatch(name, fixture = "default") {
  const fixturePayload = getConnectorFixture(name, fixture);
  if (!fixturePayload) {
    const error = new Error(`Unknown fixture: ${fixture}`);
    error.code = "INVALID_FIXTURE";
    throw error;
  }

  return {
    connected: true,
    status: "ok",
    lastSyncAt: nowIso(),
    lastErrorCode: null,
    lastErrorMessage: null,
    ...fixturePayload,
  };
}

function createScenarioPatch(name, scenario, fixture) {
  if (scenario === "error") {
    return {
      connected: true,
      status: "error",
      lastErrorCode: `${name.toUpperCase()}_SYNC_FAILED`,
      lastErrorMessage: `${name} mock sync failed`,
    };
  }

  if (scenario === "stale") {
    return {
      connected: true,
      status: "stale",
      lastErrorCode: `${name.toUpperCase()}_STALE`,
      lastErrorMessage: `${name} data is stale`,
    };
  }

  return createSuccessPatch(name, fixture);
}

export function createMockConnectorSyncService(store) {
  const jobs = new Map();

  function runSync(name, { scenario = "success", fixture = "default", delayMs = 80 } = {}) {
    if (!["calendar", "todoist"].includes(name)) {
      const error = new Error(`Unsupported connector: ${name}`);
      error.code = "INVALID_CONNECTOR";
      throw error;
    }

    const jobId = `${name}_sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const startedAt = nowIso();
    const normalizedDelayMs = Math.max(0, Number(delayMs ?? 80));

    store.patchIntegration(
      name,
      {
        connected: true,
        status: "syncing",
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      "mock_sync_worker",
    );

    const timeoutId = setTimeout(() => {
      const patch = createScenarioPatch(name, scenario, fixture);
      store.patchIntegration(name, patch, "mock_sync_worker");
      jobs.set(jobId, {
        id: jobId,
        connector: name,
        scenario,
        fixture,
        startedAt,
        finishedAt: nowIso(),
        status: patch.status,
      });
    }, normalizedDelayMs);

    jobs.set(jobId, {
      id: jobId,
      connector: name,
      scenario,
      fixture,
      startedAt,
      finishedAt: null,
      status: "syncing",
      timeoutId,
    });

    return {
      id: jobId,
      connector: name,
      scenario,
      fixture,
      startedAt,
      status: "syncing",
    };
  }

  function getJob(jobId) {
    const job = jobs.get(jobId);
    if (!job) {
      return null;
    }

    const { timeoutId, ...safeJob } = job;
    return safeJob;
  }

  return {
    runSync,
    getJob,
    listFixtures(name) {
      return listConnectorFixtures(name);
    },
  };
}
