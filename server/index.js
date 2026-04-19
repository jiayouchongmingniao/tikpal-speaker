import http from "node:http";
import { createFlowStateStore } from "./flowStateStore.js";
import { openApiDocument } from "./openapi.js";

const store = createFlowStateStore();
const PORT = Number(process.env.TIKPAL_FLOW_API_PORT ?? 8787);
const HOST = process.env.TIKPAL_FLOW_API_HOST ?? "0.0.0.0";
const API_KEY = process.env.TIKPAL_API_KEY ?? "";
const allowedOrigins = new Set(
  (process.env.TIKPAL_ALLOWED_ORIGINS ??
    "https://tikpal.ai,https://www.tikpal.ai,http://localhost:4173,http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function sendEmpty(response, statusCode, extraHeaders = {}) {
  response.writeHead(statusCode, extraHeaders);
  response.end();
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Tikpal-Key");
}

function isAuthorized(request) {
  if (!API_KEY) {
    return true;
  }

  const headerKey = request.headers["x-tikpal-key"];
  if (headerKey && headerKey === API_KEY) {
    return true;
  }

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === API_KEY) {
    return true;
  }

  return false;
}

async function parseBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function getPathSegments(request) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  return url.pathname.split("/").filter(Boolean);
}

const server = http.createServer(async (request, response) => {
  setCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    sendEmpty(response, 204);
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const path = url.pathname;
  const segments = getPathSegments(request);

  try {
    if (path === "/api/v1/flow/health" && request.method === "GET") {
      sendJson(response, 200, {
        ok: true,
        service: "tikpal-speaker-flow-api",
        time: new Date().toISOString(),
      });
      return;
    }

    if (path === "/api/v1/flow/openapi.json" && request.method === "GET") {
      sendJson(response, 200, openApiDocument);
      return;
    }

    if (path === "/api/v1/flow/state" && request.method === "GET") {
      sendJson(response, 200, store.getSnapshot());
      return;
    }

    if (path === "/api/v1/flow/state" && request.method === "PATCH") {
      if (!isAuthorized(request)) {
        sendJson(response, 401, { error: "Unauthorized" });
        return;
      }

      const body = await parseBody(request);
      const snapshot = store.patchState(body, body.source ?? "remote-client");
      sendJson(response, 200, snapshot);
      return;
    }

    if (path === "/api/v1/flow/actions" && request.method === "POST") {
      if (!isAuthorized(request)) {
        sendJson(response, 401, { error: "Unauthorized" });
        return;
      }

      const body = await parseBody(request);
      const snapshot = store.runAction(body.type, body.payload ?? {}, body.source ?? "remote-client");
      sendJson(response, 200, snapshot);
      return;
    }

    if (path === "/api/v1/flow/controller-sessions" && request.method === "POST") {
      if (!isAuthorized(request)) {
        sendJson(response, 401, { error: "Unauthorized" });
        return;
      }

      const body = await parseBody(request);
      const session = store.createSession(body, body.source ?? "tikpal");
      sendJson(response, 201, {
        ...session,
        stateUrl: `/api/v1/flow/state`,
        actionUrl: `/api/v1/flow/actions`,
      });
      return;
    }

    if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "flow" && segments[3] === "controller-sessions") {
      if (!isAuthorized(request)) {
        sendJson(response, 401, { error: "Unauthorized" });
        return;
      }

      const sessionId = segments[4];
      if (!sessionId) {
        sendJson(response, 404, { error: "Not found" });
        return;
      }

      if (request.method === "GET") {
        const session = store.getSession(sessionId);
        if (!session) {
          sendJson(response, 404, { error: "Session not found" });
          return;
        }
        sendJson(response, 200, session);
        return;
      }

      if (request.method === "DELETE") {
        const deleted = store.deleteSession(sessionId);
        sendJson(response, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Session not found" });
        return;
      }
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, {
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`tikpal-speaker Flow API listening on http://${HOST}:${PORT}/api/v1/flow`);
});
