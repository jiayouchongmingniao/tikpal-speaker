function getRuntimeApiBase() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("apiBase") ||
    window.__TIKPAL_API_BASE__ ||
    "/api/v1/flow"
  );
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
    throw new Error(`Flow API request failed with ${response.status}`);
  }

  return response.json();
}

export function createFlowServiceClient() {
  const baseUrl = getRuntimeApiBase();

  return {
    baseUrl,
    async health() {
      return requestJson(`${baseUrl}/health`);
    },
    async getState() {
      return requestJson(`${baseUrl}/state`);
    },
    async patchState(payload) {
      return requestJson(`${baseUrl}/state`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    async sendAction(type, payload = {}, source = "speaker-ui") {
      return requestJson(`${baseUrl}/actions`, {
        method: "POST",
        body: JSON.stringify({ type, payload, source }),
      });
    },
    async createControllerSession(payload) {
      return requestJson(`${baseUrl}/controller-sessions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  };
}
