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

export function getDefaultRealConnectorConfig(name, env = process.env) {
  const upperName = name.toUpperCase();
  const baseUrl =
    env[`TIKPAL_${upperName}_API_BASE`] ||
    (name === "calendar" ? "https://www.googleapis.com/calendar/v3" : "https://api.todoist.com/rest/v2");

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    timeoutMs: Number(env[`TIKPAL_${upperName}_TIMEOUT_MS`] ?? DEFAULT_TIMEOUT_MS),
    calendarId: env.TIKPAL_CALENDAR_ID || "primary",
    refreshSkewMs: Number(env[`TIKPAL_${upperName}_REFRESH_SKEW_MS`] ?? 60_000),
    tokenUrl: env[`TIKPAL_${upperName}_TOKEN_URL`] || env.TIKPAL_CONNECTOR_TOKEN_URL || null,
    clientId: env[`TIKPAL_${upperName}_CLIENT_ID`] || env.TIKPAL_CONNECTOR_CLIENT_ID || null,
    clientSecret: env[`TIKPAL_${upperName}_CLIENT_SECRET`] || env.TIKPAL_CONNECTOR_CLIENT_SECRET || null,
  };
}

export async function exchangeConnectorAuthorizationCode(
  name,
  { authorizationCode, code, redirectUri, codeVerifier, accountLabel } = {},
  { config = getDefaultRealConnectorConfig(name), fetchImpl = fetch } = {},
) {
  assertKnownConnector(name);
  const authCode = authorizationCode ?? code;
  if (!authCode) {
    throw createConnectorError(`${name.toUpperCase()}_AUTH_CODE_MISSING`, `${name} authorization code is required`);
  }

  if (!config.tokenUrl) {
    throw createConnectorError(`${name.toUpperCase()}_TOKEN_EXCHANGE_UNCONFIGURED`, `${name} token exchange URL is not configured`);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: authCode,
  });
  if (redirectUri) {
    body.set("redirect_uri", redirectUri);
  }
  if (codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }
  if (config.clientId) {
    body.set("client_id", config.clientId);
  }
  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  try {
    const payload = await requestJsonWithTimeout(config.tokenUrl, {
      fetchImpl,
      timeoutMs: config.timeoutMs,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const accessToken = payload.access_token ?? payload.accessToken;
    if (!accessToken) {
      throw createConnectorError(`${name.toUpperCase()}_TOKEN_EXCHANGE_FAILED`, `${name} token exchange did not return an access token`);
    }

    return {
      accountLabel: accountLabel ?? payload.accountLabel ?? payload.email ?? `${name}.local`,
      accessToken,
      refreshToken: payload.refresh_token ?? payload.refreshToken ?? null,
      tokenExpiresAt: payload.expires_in ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString() : payload.tokenExpiresAt ?? null,
      metadata: {
        authMethod: "authorization_code",
        tokenType: payload.token_type ?? payload.tokenType ?? null,
      },
    };
  } catch (error) {
    if (error?.code) {
      throw error;
    }

    throw createConnectorError(`${name.toUpperCase()}_TOKEN_EXCHANGE_FAILED`, error instanceof Error ? error.message : String(error));
  }
}

async function requestJsonWithTimeout(
  url,
  { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, method = "GET", headers = {}, body = undefined } = {},
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs ?? DEFAULT_TIMEOUT_MS)));

  try {
    const response = await fetchImpl(url, {
      method,
      headers,
      body,
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

function isTokenExpired(credentials = {}, refreshSkewMs = 0) {
  const expiresAtMs = credentials.tokenExpiresAt ? new Date(credentials.tokenExpiresAt).getTime() : null;
  return Boolean(expiresAtMs && expiresAtMs <= Date.now() + Number(refreshSkewMs ?? 0));
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

async function refreshConnectorCredentials(name, credentials = {}, { store = null, config = {}, fetchImpl = fetch } = {}) {
  const refreshToken = credentials.refreshToken || credentials.metadata?.refreshToken;
  const tokenUrl = credentials.metadata?.refreshUrl || config.tokenUrl;
  if (!refreshToken) {
    throw createConnectorError(`${name.toUpperCase()}_TOKEN_EXPIRED`, `${name} token is expired and no refresh token is available`);
  }

  if (!tokenUrl) {
    throw createConnectorError(`${name.toUpperCase()}_TOKEN_REFRESH_UNCONFIGURED`, `${name} token refresh URL is not configured`);
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (config.clientId) {
    body.set("client_id", config.clientId);
  }
  if (config.clientSecret) {
    body.set("client_secret", config.clientSecret);
  }

  try {
    const payload = await requestJsonWithTimeout(tokenUrl, {
      fetchImpl,
      timeoutMs: config.timeoutMs,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const accessToken = payload.access_token ?? payload.accessToken;
    if (!accessToken) {
      throw createConnectorError(`${name.toUpperCase()}_TOKEN_REFRESH_FAILED`, `${name} token refresh did not return an access token`);
    }

    const tokenExpiresAt = payload.expires_in
      ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString()
      : payload.tokenExpiresAt ?? credentials.tokenExpiresAt ?? null;
    const refreshed = {
      ...credentials,
      accessToken,
      refreshToken: payload.refresh_token ?? payload.refreshToken ?? refreshToken,
      tokenExpiresAt,
      metadata: {
        ...(credentials.metadata ?? {}),
        refreshedAt: nowIso(),
      },
    };

    store?.updateIntegrationCredential?.(
      name,
      {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        tokenExpiresAt: refreshed.tokenExpiresAt,
        metadata: refreshed.metadata,
      },
      "connector_token_refresh",
    );

    return store?.getIntegrationCredential?.(name) ?? refreshed;
  } catch (error) {
    if (error?.code) {
      throw error;
    }

    throw createConnectorError(`${name.toUpperCase()}_TOKEN_REFRESH_FAILED`, error instanceof Error ? error.message : String(error));
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
      let connectorCredentials = getIntegrationCredentials(store, name, credentials);
      assertUsableCredentials(name, connectorCredentials);
      if (isTokenExpired(connectorCredentials, adapterConfig.refreshSkewMs)) {
        connectorCredentials = await refreshConnectorCredentials(name, connectorCredentials, {
          store,
          config: adapterConfig,
          fetchImpl,
        });
      }
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
          ? createRealConnectorAdapter(name, { store, config: getDefaultRealConnectorConfig(name, env), fetchImpl })
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
