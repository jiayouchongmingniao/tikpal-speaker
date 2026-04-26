import { createConnectorAdapterRegistry } from "./connectorAdapters.js";

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockConnectorSyncService(store, { adapterRegistry = createConnectorAdapterRegistry() } = {}) {
  const jobs = new Map();

  function runSync(name, { scenario = "success", fixture = "default", delayMs = 80, maxAttempts = 1, retryDelayMs = 120 } = {}) {
    const adapter = adapterRegistry.get(name);

    const jobId = `${name}_sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const startedAt = nowIso();
    const normalizedDelayMs = Math.max(0, Number(delayMs ?? 80));
    const normalizedMaxAttempts = Math.max(1, Math.min(5, Number(maxAttempts ?? 1)));
    const normalizedRetryDelayMs = Math.max(0, Number(retryDelayMs ?? 120));

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

    async function completeSync() {
      let lastError = null;

      for (let attempt = 1; attempt <= normalizedMaxAttempts; attempt += 1) {
        jobs.set(jobId, {
          ...jobs.get(jobId),
          attempts: attempt,
          status: "syncing",
          lastErrorCode: lastError?.code ?? null,
          nextRetryAt: null,
        });

        try {
          const patch = await adapterRegistry.sync(name, { scenario, fixture });
          store.patchIntegration(name, patch, "mock_sync_worker");
          jobs.set(jobId, {
            ...jobs.get(jobId),
            finishedAt: nowIso(),
            status: patch.status,
            attempts: attempt,
            lastErrorCode: null,
            nextRetryAt: null,
          });
          return;
        } catch (error) {
          lastError = error;
          const code = error?.code ?? "CONNECTOR_SYNC_FAILED";
          if (attempt < normalizedMaxAttempts) {
            const nextRetryAt = new Date(Date.now() + normalizedRetryDelayMs).toISOString();
            jobs.set(jobId, {
              ...jobs.get(jobId),
              attempts: attempt,
              status: "retrying",
              lastErrorCode: code,
              nextRetryAt,
            });
            await sleep(normalizedRetryDelayMs);
            continue;
          }

          const patch = {
            connected: true,
            status: "error",
            lastErrorCode: code,
            lastErrorMessage: error instanceof Error ? error.message : String(error),
          };
          store.patchIntegration(name, patch, "mock_sync_worker");
          jobs.set(jobId, {
            ...jobs.get(jobId),
            finishedAt: nowIso(),
            status: "error",
            attempts: attempt,
            errorCode: code,
            lastErrorCode: code,
            nextRetryAt: null,
          });
        }
      }
    }

    const timeoutId = setTimeout(async () => {
      await completeSync();
    }, normalizedDelayMs);

    jobs.set(jobId, {
      id: jobId,
      connector: name,
      adapterMode: adapter.mode ?? "unknown",
      scenario,
      fixture,
      startedAt,
      finishedAt: null,
      status: "syncing",
      attempts: 0,
      maxAttempts: normalizedMaxAttempts,
      retryDelayMs: normalizedRetryDelayMs,
      lastErrorCode: null,
      nextRetryAt: null,
      timeoutId,
    });

    return {
      id: jobId,
      connector: name,
      adapterMode: adapter.mode ?? "unknown",
      scenario,
      fixture,
      startedAt,
      status: "syncing",
      attempts: 0,
      maxAttempts: normalizedMaxAttempts,
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
