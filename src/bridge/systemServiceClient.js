function getRuntimeApiBase() {
  const params = new URLSearchParams(window.location.search);
  return params.get("systemApiBase") || window.__TIKPAL_SYSTEM_API_BASE__ || "/api/v1/system";
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

  return {
    baseUrl,
    async health() {
      return requestJson(`${baseUrl}/health`);
    },
    async getState() {
      return requestJson(`${baseUrl}/state`);
    },
    async getCapabilities() {
      return requestJson(`${baseUrl}/capabilities`);
    },
    async sendAction(type, payload = {}, source = "speaker-ui") {
      const requestId = `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      return requestJson(`${baseUrl}/actions`, {
        method: "POST",
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
