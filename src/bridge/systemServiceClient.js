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
    throw new Error(`System API request failed with ${response.status}`);
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
      return requestJson(`${baseUrl}/actions`, {
        method: "POST",
        body: JSON.stringify({ type, payload, source }),
      });
    },
  };
}
