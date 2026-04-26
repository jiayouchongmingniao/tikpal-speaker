import { createConnectorAdapterRegistry } from "./connectorAdapters.js";

function nowIso() {
  return new Date().toISOString();
}

export function createMockConnectorSyncService(store, { adapterRegistry = createConnectorAdapterRegistry() } = {}) {
  const jobs = new Map();

  function runSync(name, { scenario = "success", fixture = "default", delayMs = 80 } = {}) {
    adapterRegistry.get(name);

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

    const timeoutId = setTimeout(async () => {
      try {
        const patch = await adapterRegistry.sync(name, { scenario, fixture });
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
      } catch (error) {
        const code = error?.code ?? "CONNECTOR_SYNC_FAILED";
        const patch = {
          connected: true,
          status: "error",
          lastErrorCode: code,
          lastErrorMessage: error instanceof Error ? error.message : String(error),
        };
        store.patchIntegration(name, patch, "mock_sync_worker");
        jobs.set(jobId, {
          id: jobId,
          connector: name,
          scenario,
          fixture,
          startedAt,
          finishedAt: nowIso(),
          status: "error",
          errorCode: code,
        });
      }
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
      return adapterRegistry.listFixtures(name);
    },
  };
}
