import { getConnectorFixture, listConnectorFixtures } from "./mockConnectorFixtures.js";

const CONNECTOR_NAMES = ["calendar", "todoist"];
const DEFAULT_TIMEOUT_MS = 8000;

function nowIso() {
  return new Date().toISOString();
}

function createConnectorError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === "ABORT_ERR";
}

function normalizeBaseUrl(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

function getDefaultRealConnectorConfig(name, env = process.env) {
  const upperName = name.toUpperCase();
  const baseUrl =
    env[`TIKPAL_${upperName}_API_BASE`] ||
    (name === "calendar" ? "https://www.googleapis.com/calendar/v3" : "https://api.todoist.com/rest/v2");

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    timeoutMs: Number(env[`TIKPAL_${upperName}_TIMEOUT_MS`] ?? DEFAULT_TIMEOUT_MS),
    calendarId: env.TIKPAL_CALENDAR_ID || "primary",
  };
}

async function requestJsonWithTimeout(url, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs ?? DEFAULT_TIMEOUT_MS)));

  try {
    const response = await fetchImpl(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createConnectorError("CONNECTOR_HTTP_ERROR", `Connector request failed with ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw createConnectorError("CONNECTOR_TIMEOUT", `Connector request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getAccessToken(credentials = {}) {
  return credentials.accessToken || credentials.metadata?.accessToken || credentials.metadata?.token || null;
}

function hasRefreshPath(credentials = {}) {
  return Boolean(credentials.refreshToken || credentials.metadata?.refreshToken || credentials.metadata?.refreshUrl);
}

function assertUsableCredentials(name, credentials = {}) {
  if (!credentials?.credentialRef) {
    throw createConnectorError(`${name.toUpperCase()}_CREDENTIAL_MISSING`, `${name} connector is not bound`);
  }

  const expiresAtMs = credentials.tokenExpiresAt ? new Date(credentials.tokenExpiresAt).getTime() : null;
  if (expiresAtMs && expiresAtMs <= Date.now() && !hasRefreshPath(credentials)) {
    throw createConnectorError(`${name.toUpperCase()}_TOKEN_EXPIRED`, `${name} token is expired and no refresh path is configured`);
  }
}

function getIntegrationCredentials(store, name, fallbackCredentials = null) {
  return store?.getIntegrationCredential?.(name) ?? fallbackCredentials ?? null;
}

function mapCalendarEvents(payload = {}, accountLabel = "calendar") {
  const events = Array.isArray(payload.items) ? payload.items : [];
  const [currentEvent, nextEvent] = events;
  return {
    connected: true,
    status: "ok",
    accountLabel,
    lastSyncAt: nowIso(),
    lastErrorCode: null,
    lastErrorMessage: null,
    currentEvent: currentEvent
      ? {
          id: currentEvent.id ?? "calendar_current",
          title: currentEvent.summary ?? currentEvent.title ?? "Calendar block",
          startsAt: currentEvent.start?.dateTime ?? currentEvent.start?.date ?? currentEvent.startsAt,
          endsAt: currentEvent.end?.dateTime ?? currentEvent.end?.date ?? currentEvent.endsAt,
        }
      : null,
    nextEvent: nextEvent
      ? {
          id: nextEvent.id ?? "calendar_next",
          title: nextEvent.summary ?? nextEvent.title ?? "Next calendar block",
          startsAt: nextEvent.start?.dateTime ?? nextEvent.start?.date ?? nextEvent.startsAt,
        }
      : null,
    remainingEvents: events.length,
  };
}

function mapTodoistTasks(payload = {}, accountLabel = "todoist") {
  const tasks = Array.isArray(payload) ? payload : Array.isArray(payload.items) ? payload.items : [];
  const [currentTask, nextTask] = tasks;
  return {
    connected: true,
    status: "ok",
    accountLabel,
    lastSyncAt: nowIso(),
    lastErrorCode: null,
    lastErrorMessage: null,
    currentTask: currentTask
      ? {
          id: currentTask.id ?? "todoist_current",
          title: currentTask.content ?? currentTask.title ?? "Todoist task",
          priority: currentTask.priority,
          dueAt: currentTask.due?.datetime ?? currentTask.due?.date ?? currentTask.dueAt,
        }
      : null,
    nextTask: nextTask
      ? {
          id: nextTask.id ?? "todoist_next",
          title: nextTask.content ?? nextTask.title ?? "Next Todoist task",
          startsAt: nextTask.due?.datetime ?? nextTask.due?.date ?? nextTask.startsAt,
        }
      : null,
    remainingTasks: tasks.length,
  };
}

function assertKnownConnector(name) {
  if (!CONNECTOR_NAMES.includes(name)) {
    throw createConnectorError("INVALID_CONNECTOR", `Unsupported connector: ${name}`);
  }
}

function createFixtureSuccessPatch(name, fixture = "default") {
  const fixturePayload = getConnectorFixture(name, fixture);
  if (!fixturePayload) {
    throw createConnectorError("INVALID_FIXTURE", `Unknown fixture: ${fixture}`);
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

export function createFixtureConnectorAdapter(name) {
  assertKnownConnector(name);

  return {
    name,
    mode: "fixture",
    listFixtures() {
      return listConnectorFixtures(name);
    },
    async sync({ scenario = "success", fixture = "default" } = {}) {
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

      return createFixtureSuccessPatch(name, fixture);
    },
  };
}

export function createRealConnectorAdapter(name, { store = null, credentials = null, config = {}, fetchImpl = fetch } = {}) {
  assertKnownConnector(name);
  const defaultConfig = getDefaultRealConnectorConfig(name);
  const adapterConfig = {
    ...defaultConfig,
    ...config,
    baseUrl: normalizeBaseUrl(config.baseUrl ?? defaultConfig.baseUrl),
  };

  return {
    name,
    mode: "real",
    listFixtures() {
      return [];
    },
    async sync() {
      const connectorCredentials = getIntegrationCredentials(store, name, credentials);
      assertUsableCredentials(name, connectorCredentials);
      const accessToken = getAccessToken(connectorCredentials);
      if (!accessToken) {
        throw createConnectorError(`${name.toUpperCase()}_TOKEN_UNAVAILABLE`, `${name} access token is unavailable`);
      }

      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };

      if (name === "calendar") {
        const url = new URL(`${adapterConfig.baseUrl}/calendars/${encodeURIComponent(adapterConfig.calendarId)}/events`);
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        url.searchParams.set("timeMin", new Date().toISOString());
        url.searchParams.set("maxResults", String(adapterConfig.maxResults ?? 8));
        const payload = await requestJsonWithTimeout(url, {
          fetchImpl,
          timeoutMs: adapterConfig.timeoutMs,
          headers,
        });
        return mapCalendarEvents(payload, connectorCredentials.accountLabel ?? "calendar");
      }

      const url = new URL(`${adapterConfig.baseUrl}/tasks`);
      if (adapterConfig.filter) {
        url.searchParams.set("filter", adapterConfig.filter);
      }
      const payload = await requestJsonWithTimeout(url, {
        fetchImpl,
        timeoutMs: adapterConfig.timeoutMs,
        headers,
      });
      return mapTodoistTasks(payload, connectorCredentials.accountLabel ?? "todoist");
    },
  };
}

function shouldUseRealAdapter(name, env = process.env) {
  const upperName = name.toUpperCase();
  return env[`TIKPAL_${upperName}_CONNECTOR_MODE`] === "real" || env.TIKPAL_CONNECTOR_MODE === "real";
}

export function createConnectorAdapterRegistry(overrides = {}, { store = null, env = process.env, fetchImpl = fetch } = {}) {
  const adapters = new Map(
    CONNECTOR_NAMES.map((name) => [
      name,
      overrides[name] ??
        (shouldUseRealAdapter(name, env)
          ? createRealConnectorAdapter(name, { store, fetchImpl })
          : createFixtureConnectorAdapter(name)),
    ]),
  );

  return {
    names: [...CONNECTOR_NAMES],
    get(name) {
      assertKnownConnector(name);
      return adapters.get(name);
    },
    listFixtures(name) {
      return this.get(name).listFixtures?.() ?? [];
    },
    async sync(name, options = {}) {
      const adapter = this.get(name);
      if (!adapter?.sync) {
        throw createConnectorError("CONNECTOR_SYNC_UNAVAILABLE", `Connector ${name} does not support sync`);
      }

      return adapter.sync(options);
    },
  };
}
