function getRuntimeApiBase() {
  const params = new URLSearchParams(window.location.search);
  return params.get("systemApiBase") || window.__TIKPAL_SYSTEM_API_BASE__ || "/api/v1/system";
}

function getRuntimePortableApiKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get("apiKey") || window.localStorage.getItem("tikpal-portable-api-key") || "";
}

function getRuntimePortableSessionToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("sessionToken") || window.localStorage.getItem("tikpal-portable-session-token") || "";
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch {
      // Ignore JSON parse failures for non-JSON error bodies.
    }

    const message =
      errorPayload?.error?.message ??
      errorPayload?.message ??
      `System API request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = errorPayload;
    throw error;
  }

  return response.json();
}

export function createSystemServiceClient() {
  const baseUrl = getRuntimeApiBase();
  let apiKey = getRuntimePortableApiKey();
  let sessionToken = getRuntimePortableSessionToken();

  function getAuthHeaders({ admin = false } = {}) {
    if (admin && apiKey) {
      return {
        "X-Tikpal-Key": apiKey,
      };
    }

    if (sessionToken) {
      return {
        Authorization: `Bearer ${sessionToken}`,
      };
    }

    return {};
  }

  return {
    baseUrl,
    get apiKey() {
      return apiKey;
    },
    get sessionToken() {
      return sessionToken;
    },
    setApiKey(nextApiKey) {
      apiKey = nextApiKey ?? "";
      if (apiKey) {
        window.localStorage.setItem("tikpal-portable-api-key", apiKey);
      } else {
        window.localStorage.removeItem("tikpal-portable-api-key");
      }
    },
    setSessionToken(nextSessionToken) {
      sessionToken = nextSessionToken ?? "";
      if (sessionToken) {
        window.localStorage.setItem("tikpal-portable-session-token", sessionToken);
      } else {
        window.localStorage.removeItem("tikpal-portable-session-token");
      }
    },
    clearPortableAuth() {
      apiKey = "";
      sessionToken = "";
      window.localStorage.removeItem("tikpal-portable-api-key");
      window.localStorage.removeItem("tikpal-portable-session-token");
    },
    async health() {
      return requestJson(`${baseUrl}/health`);
    },
    async getState() {
      return requestJson(`${baseUrl}/state`, {
        headers: getAuthHeaders(),
      });
    },
    async getCapabilities() {
      return requestJson(`${baseUrl}/capabilities`, {
        headers: getAuthHeaders(),
      });
    },
    async getScreenContext() {
      return requestJson(`${baseUrl}/screen/context`, {
        headers: getAuthHeaders(),
      });
    },
    async getRuntimeSummary() {
      return requestJson(`${baseUrl}/runtime/summary`, {
        headers: getAuthHeaders({ admin: true }),
      });
    },
    async getRuntimeActionLog(limit = 30) {
      return requestJson(`${baseUrl}/runtime/action-log?limit=${encodeURIComponent(limit)}`, {
        headers: getAuthHeaders({ admin: true }),
      });
    },
    async getRuntimeStateTransitions(limit = 30) {
      return requestJson(`${baseUrl}/runtime/state-transitions?limit=${encodeURIComponent(limit)}`, {
        headers: getAuthHeaders({ admin: true }),
      });
    },
    async listIntegrations() {
      return requestJson(`${baseUrl}/integrations`, {
        headers: getAuthHeaders({ admin: true }),
      });
    },
    async connectIntegration(connector, payload = {}) {
      return requestJson(`${baseUrl}/integrations/${encodeURIComponent(connector)}/connect`, {
        method: "POST",
        headers: getAuthHeaders({ admin: true }),
        body: JSON.stringify(payload),
      });
    },
    async refreshIntegration(connector, payload = {}) {
      return requestJson(`${baseUrl}/integrations/${encodeURIComponent(connector)}/refresh`, {
        method: "POST",
        headers: getAuthHeaders({ admin: true }),
        body: JSON.stringify(payload),
      });
    },
    async disconnectIntegration(connector) {
      return requestJson(`${baseUrl}/integrations/${encodeURIComponent(connector)}`, {
        method: "DELETE",
        headers: getAuthHeaders({ admin: true }),
      });
    },
    async getOtaStatus() {
      return requestJson(`${baseUrl}/ota/status`, {
        headers: getAuthHeaders(),
      });
    },
    async checkOta(payload = {}) {
      return requestJson(`${baseUrl}/ota/check`, {
        method: "POST",
        headers: getAuthHeaders({ admin: true }),
        body: JSON.stringify(payload),
      });
    },
    async applyOta(payload = {}) {
      return requestJson(`${baseUrl}/ota/apply`, {
        method: "POST",
        headers: getAuthHeaders({ admin: true }),
        body: JSON.stringify(payload),
      });
    },
    async rollbackOta(payload = {}) {
      return requestJson(`${baseUrl}/ota/rollback`, {
        method: "POST",
        headers: getAuthHeaders({ admin: true }),
        body: JSON.stringify(payload),
      });
    },
    async listConnectorFixtures(connector) {
      return requestJson(`${baseUrl}/integrations/${connector}/fixtures`, {
        headers: getAuthHeaders(),
      });
    },
    async triggerConnectorSync(connector, payload = {}) {
      return requestJson(`${baseUrl}/integrations/${connector}/sync`, {
        method: "POST",
        headers: getAuthHeaders({ admin: true }),
        body: JSON.stringify(payload),
      });
    },
    async getConnectorSyncJob(connector, jobId) {
      return requestJson(`${baseUrl}/integrations/${connector}/sync-jobs/${jobId}`, {
        headers: getAuthHeaders(),
      });
    },
    async getPortableBootstrap() {
      return requestJson(`${baseUrl}/portable/bootstrap`, {
        headers: getAuthHeaders(),
      });
    },
    async createControllerSession({
      deviceId = "tikpal-portable-web",
      name = "Tikpal Portable Web",
      role = "controller",
      capabilities = ["mode_switch", "playback", "flow_control", "screen_control"],
      ttlSec,
    } = {}) {
      const session = await requestJson(`${baseUrl}/controller-sessions`, {
        method: "POST",
        headers: getAuthHeaders({ admin: true }),
        body: JSON.stringify({
          deviceId,
          name,
          role,
          capabilities,
          ttlSec,
        }),
      });
      if (session?.token) {
        this.setSessionToken(session.token);
      }
      return session;
    },
    async createPairingCode({
      role = "controller",
      capabilities = ["mode_switch", "playback", "flow_control", "screen_control"],
      ttlSec,
    } = {}) {
      return requestJson(`${baseUrl}/pairing-codes`, {
        method: "POST",
        headers: getAuthHeaders({ admin: true }),
        body: JSON.stringify({
          role,
          capabilities,
          ttlSec,
        }),
      });
    },
    async claimPairingCode({
      code,
      deviceId = "tikpal-portable-web",
      name = "Tikpal Portable Web",
      capabilities = ["mode_switch", "playback", "flow_control", "screen_control"],
      ttlSec,
    }) {
      const session = await requestJson(`${baseUrl}/pairing-codes/claim`, {
        method: "POST",
        body: JSON.stringify({
          code,
          deviceId,
          name,
          capabilities,
          ttlSec,
          source: "portable_controller",
        }),
      });
      if (session?.token) {
        this.setSessionToken(session.token);
      }
      return session;
    },
    async getControllerSession(sessionId) {
      return requestJson(`${baseUrl}/controller-sessions/${sessionId}`, {
        headers: getAuthHeaders(),
      });
    },
    async getCurrentControllerSession() {
      return requestJson(`${baseUrl}/controller-sessions/current`, {
        headers: getAuthHeaders(),
      });
    },
    async revokeControllerSession(sessionId) {
      const response = await requestJson(`${baseUrl}/controller-sessions/${sessionId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (response?.ok) {
        this.setSessionToken("");
      }
      return response;
    },
    async sendAction(type, payload = {}, source = "speaker-ui") {
      const requestId = `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      return requestJson(`${baseUrl}/actions`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          type,
          payload,
          source,
          requestId,
          timestamp: new Date().toISOString(),
        }),
      });
    },
  };
}
