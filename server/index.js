import http from "node:http";
import { fileURLToPath } from "node:url";
import { createConnectorAdapterRegistry, exchangeConnectorAuthorizationCode } from "./connectorAdapters.js";
import { createJsonFilePersistence } from "./localPersistence.js";
import { createJsonFileSecretStore } from "./localSecretStore.js";
import { createMockConnectorSyncService } from "./mockConnectorSyncService.js";
import { createFileSystemOtaManager } from "./otaReleaseManager.js";
import { flowOpenApiDocument, systemOpenApiDocument } from "./openapi.js";
import { createScreenContext } from "./screenContextService.js";
import { createSystemStateStore } from "./systemStateStore.js";

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

function setCorsHeaders(request, response, allowedOrigins) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Tikpal-Key");
}

function isAuthorized(request, apiKey) {
  if (!apiKey) {
    return true;
  }

  const headerKey = request.headers["x-tikpal-key"];
  if (headerKey && headerKey === apiKey) {
    return true;
  }

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === apiKey) {
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

function sendUnauthorized(response) {
  sendJson(response, 401, {
    ok: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    },
  });
}

function sendForbidden(response, code = "FORBIDDEN", message = "Forbidden") {
  sendJson(response, 403, {
    ok: false,
    error: {
      code,
      message,
    },
  });
}

function getBearerToken(request) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return "";
  }

  return authHeader.slice(7);
}

function resolveAuthContext(request, store, apiKey) {
  if (!apiKey) {
    return {
      ok: true,
      role: "admin",
      kind: "development",
      session: null,
    };
  }

  const headerKey = request.headers["x-tikpal-key"];
  if (headerKey && headerKey === apiKey) {
    return {
      ok: true,
      role: "admin",
      kind: "api_key",
      session: null,
    };
  }

  const bearerToken = getBearerToken(request);
  if (bearerToken === apiKey) {
    return {
      ok: true,
      role: "admin",
      kind: "api_key",
      session: null,
    };
  }

  if (bearerToken) {
    const session = store.getSessionByToken(bearerToken, { touch: true });
    if (session) {
      return {
        ok: true,
        role: session.role,
        kind: "controller_session",
        session,
      };
    }

    return {
      ok: false,
      status: 401,
      code: "SESSION_INVALID",
      message: "Controller session is invalid or expired",
    };
  }

  return {
    ok: true,
    role: "viewer",
    kind: "anonymous",
    session: null,
  };
}

function authorizeRequest(request, response, store, apiKey, requiredRole = "viewer") {
  const auth = resolveAuthContext(request, store, apiKey);
  if (!auth.ok) {
    sendJson(response, auth.status ?? 401, {
      ok: false,
      error: {
        code: auth.code ?? "UNAUTHORIZED",
        message: auth.message ?? "Unauthorized",
      },
    });
    return null;
  }

  if (!store.hasRequiredRole(auth.role, requiredRole)) {
    sendForbidden(response, "FORBIDDEN", `Role ${auth.role} cannot access this resource`);
    return null;
  }

  return auth;
}

function sendActionResult(response, previousState, nextState, body) {
  const result = JSON.stringify(previousState) === JSON.stringify(nextState) ? "ignored" : "applied";
  sendJson(response, 200, {
    ok: true,
    result,
    state: nextState,
    appliedAction: {
      type: body.type,
      requestId: body.requestId ?? null,
      timestamp: body.timestamp ?? null,
    },
  });
}

function sendActionError(response, statusCode, body, code, message) {
  sendJson(response, statusCode, {
    ok: false,
    result: "rejected",
    state: null,
    appliedAction: {
      type: body?.type ?? null,
      requestId: body?.requestId ?? null,
      timestamp: body?.timestamp ?? null,
    },
    error: {
      code,
      message,
    },
  });
}

function createSystemApiDescriptor() {
  return {
    service: "tikpal-speaker-system-api",
    version: "1.0.0",
    auth: {
      read: "anonymous viewer or authenticated session",
      write: "controller session or admin api key",
      pairing: "admin api key required for controller session creation",
    },
    endpoints: {
      health: "/api/v1/system/health",
      openapi: "/api/v1/system/openapi.json",
      state: "/api/v1/system/state",
      capabilities: "/api/v1/system/capabilities",
      screenContext: "/api/v1/system/screen/context",
      runtimeSummary: "/api/v1/system/runtime/summary",
      runtimeActionLog: "/api/v1/system/runtime/action-log",
      runtimeStateTransitions: "/api/v1/system/runtime/state-transitions",
      runtimePerformanceSamples: "/api/v1/system/runtime/performance-samples",
      otaStatus: "/api/v1/system/ota/status",
      otaCheck: "/api/v1/system/ota/check",
      otaApply: "/api/v1/system/ota/apply",
      otaRollback: "/api/v1/system/ota/rollback",
      actions: "/api/v1/system/actions",
      creativeCareActions: {
        submitVoiceCapture: "POST /api/v1/system/actions voice_capture_submit",
        setMood: "POST /api/v1/system/actions voice_mood_set",
        setCareMode: "POST /api/v1/system/actions voice_care_mode_set",
        clearReflection: "POST /api/v1/system/actions voice_reflection_clear",
      },
      integrations: "/api/v1/system/integrations",
      calendarIntegration: "/api/v1/system/integrations/calendar",
      calendarConnect: "/api/v1/system/integrations/calendar/connect",
      calendarRefresh: "/api/v1/system/integrations/calendar/refresh",
      calendarFixtures: "/api/v1/system/integrations/calendar/fixtures",
      calendarSync: "/api/v1/system/integrations/calendar/sync",
      todoistIntegration: "/api/v1/system/integrations/todoist",
      todoistConnect: "/api/v1/system/integrations/todoist/connect",
      todoistRefresh: "/api/v1/system/integrations/todoist/refresh",
      todoistFixtures: "/api/v1/system/integrations/todoist/fixtures",
      todoistSync: "/api/v1/system/integrations/todoist/sync",
      bootstrap: "/api/v1/system/portable/bootstrap",
      pairingCodes: "/api/v1/system/pairing-codes",
      pairingClaim: "/api/v1/system/pairing-codes/claim",
      controllerSessions: "/api/v1/system/controller-sessions",
      currentSession: "/api/v1/system/controller-sessions/current",
    },
  };
}

function createDefaultSystemStateStore() {
  const otaManager = process.env.TIKPAL_OTA_RELEASE_ROOT ? createFileSystemOtaManager() : null;
  if (process.env.TIKPAL_DISABLE_PERSISTENCE === "1") {
    return createSystemStateStore({
      secretStore: createJsonFileSecretStore(),
      otaManager,
    });
  }

  return createSystemStateStore({
    persistence: createJsonFilePersistence(),
    secretStore: createJsonFileSecretStore(),
    otaManager,
  });
}

function createDefaultConnectorSyncService(store) {
  return createMockConnectorSyncService(store, {
    adapterRegistry: createConnectorAdapterRegistry({}, { store }),
  });
}

export function createAppServer({
  store = createDefaultSystemStateStore(),
  connectorSyncService = createDefaultConnectorSyncService(store),
  connectorTokenExchange = exchangeConnectorAuthorizationCode,
  apiKey = process.env.TIKPAL_API_KEY ?? "",
  allowedOrigins = new Set(
    (process.env.TIKPAL_ALLOWED_ORIGINS ??
      "https://tikpal.ai,https://www.tikpal.ai,http://localhost:4173,http://localhost:3000")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ),
} = {}) {
  return http.createServer(async (request, response) => {
    setCorsHeaders(request, response, allowedOrigins);
    let actionBody = null;

    if (request.method === "OPTIONS") {
      sendEmpty(response, 204);
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);
    const path = url.pathname;
    const segments = getPathSegments(request);

    try {
      if (path === "/api/v1/system/health" && request.method === "GET") {
        sendJson(response, 200, {
          ok: true,
          service: "tikpal-speaker-system-api",
          time: new Date().toISOString(),
        });
        return;
      }

      if (path === "/api/v1/system" && request.method === "GET") {
        sendJson(response, 200, createSystemApiDescriptor());
        return;
      }

      if (path === "/api/v1/system/openapi.json" && request.method === "GET") {
        sendJson(response, 200, systemOpenApiDocument);
        return;
      }

      if (path === "/api/v1/system/state" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "viewer");
        if (!auth) {
          return;
        }
        sendJson(response, 200, store.getSnapshot());
        return;
      }

      if (path === "/api/v1/system/capabilities" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "viewer");
        if (!auth) {
          return;
        }
        sendJson(response, 200, store.getCapabilities());
        return;
      }

      if (path === "/api/v1/system/screen/context" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "viewer");
        if (!auth) {
          return;
        }

        sendJson(response, 200, createScreenContext(store.getSnapshot()));
        return;
      }

      if (path === "/api/v1/system/runtime/summary" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "operator");
        if (!auth) {
          return;
        }

        sendJson(response, 200, store.getRuntimeSummary());
        return;
      }

      if (path === "/api/v1/system/runtime/action-log" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "operator");
        if (!auth) {
          return;
        }

        sendJson(response, 200, {
          items: store.getActionLogs(url.searchParams.get("limit")),
        });
        return;
      }

      if (path === "/api/v1/system/runtime/state-transitions" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "operator");
        if (!auth) {
          return;
        }

        sendJson(response, 200, {
          items: store.getStateTransitionLogs(url.searchParams.get("limit")),
        });
        return;
      }

      if (path === "/api/v1/system/runtime/performance-samples" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "operator");
        if (!auth) {
          return;
        }

        sendJson(response, 200, {
          items: store.getPerformanceSamples(url.searchParams.get("limit")),
        });
        return;
      }

      if (path === "/api/v1/system/ota/status" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "viewer");
        if (!auth) {
          return;
        }

        sendJson(response, 200, store.getSnapshot().system?.ota ?? {});
        return;
      }

      if (path === "/api/v1/system/ota/check" && request.method === "POST") {
        const auth = authorizeRequest(request, response, store, apiKey, "admin");
        if (!auth) {
          return;
        }

        const body = await parseBody(request);
        actionBody = { ...body, type: "ota_check" };
        const previousState = structuredClone(store.getSnapshot());
        const snapshot = store.runAction("ota_check", body, body.source ?? "admin_client");
        sendActionResult(
          response,
          previousState,
          snapshot,
          {
            type: "ota_check",
            requestId: body.requestId ?? null,
            timestamp: body.timestamp ?? null,
          },
        );
        return;
      }

      if (path === "/api/v1/system/ota/apply" && request.method === "POST") {
        const auth = authorizeRequest(request, response, store, apiKey, "admin");
        if (!auth) {
          return;
        }

        const body = await parseBody(request);
        actionBody = { ...body, type: "ota_apply" };
        const previousState = structuredClone(store.getSnapshot());
        const snapshot = store.runAction("ota_apply", body, body.source ?? "admin_client");
        sendActionResult(
          response,
          previousState,
          snapshot,
          {
            type: "ota_apply",
            requestId: body.requestId ?? null,
            timestamp: body.timestamp ?? null,
          },
        );
        return;
      }

      if (path === "/api/v1/system/ota/rollback" && request.method === "POST") {
        const auth = authorizeRequest(request, response, store, apiKey, "admin");
        if (!auth) {
          return;
        }

        const body = await parseBody(request);
        actionBody = { ...body, type: "ota_rollback" };
        const previousState = structuredClone(store.getSnapshot());
        const snapshot = store.runAction("ota_rollback", body, body.source ?? "admin_client");
        sendActionResult(
          response,
          previousState,
          snapshot,
          {
            type: "ota_rollback",
            requestId: body.requestId ?? null,
            timestamp: body.timestamp ?? null,
          },
        );
        return;
      }

      if (path === "/api/v1/system/integrations" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "admin");
        if (!auth) {
          return;
        }

        sendJson(response, 200, {
          items: store.getIntegrationStatuses(),
        });
        return;
      }

      if (
        segments[0] === "api" &&
        segments[1] === "v1" &&
        segments[2] === "system" &&
        segments[3] === "integrations" &&
        segments[4] &&
        segments[5] === "connect" &&
        request.method === "POST"
      ) {
        const auth = authorizeRequest(request, response, store, apiKey, "admin");
        if (!auth) {
          return;
        }

        const body = await parseBody(request);
        const tokenPayload =
          !body.accessToken && (body.authorizationCode || body.code)
            ? await connectorTokenExchange(segments[4], body)
            : body;
        sendJson(response, 200, store.bindIntegration(segments[4], tokenPayload, "admin_client"));
        return;
      }

      if (
        segments[0] === "api" &&
        segments[1] === "v1" &&
        segments[2] === "system" &&
        segments[3] === "integrations" &&
        segments[4] &&
        segments[5] === "refresh" &&
        request.method === "POST"
      ) {
        const auth = authorizeRequest(request, response, store, apiKey, "admin");
        if (!auth) {
          return;
        }

        const body = await parseBody(request);
        if (!store.hasIntegrationCredential(segments[4])) {
          sendJson(response, 409, {
            ok: false,
            error: {
              code: "CONNECTOR_NOT_BOUND",
              message: `Connector ${segments[4]} is not bound`,
            },
          });
          return;
        }

        sendJson(response, 202, connectorSyncService.runSync(segments[4], body));
        return;
      }

      if (
        segments[0] === "api" &&
        segments[1] === "v1" &&
        segments[2] === "system" &&
        segments[3] === "integrations" &&
        segments[4] &&
        !segments[5] &&
        request.method === "DELETE"
      ) {
        const auth = authorizeRequest(request, response, store, apiKey, "admin");
        if (!auth) {
          return;
        }

        sendJson(response, 200, store.revokeIntegration(segments[4], "admin_client"));
        return;
      }

      if (path === "/api/v1/system/integrations/calendar" && request.method === "PATCH") {
        const auth = authorizeRequest(request, response, store, apiKey, "operator");
        if (!auth) {
          return;
        }

        const body = await parseBody(request);
        sendJson(response, 200, store.patchIntegration("calendar", body, "admin_client"));
        return;
      }

      if (path === "/api/v1/system/integrations/calendar/sync" && request.method === "POST") {
        const auth = authorizeRequest(request, response, store, apiKey, "operator");
        if (!auth) {
          return;
        }

        const body = await parseBody(request);
        sendJson(response, 202, connectorSyncService.runSync("calendar", body));
        return;
      }

      if (path === "/api/v1/system/integrations/calendar/fixtures" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "viewer");
        if (!auth) {
          return;
        }

        sendJson(response, 200, {
          connector: "calendar",
          fixtures: connectorSyncService.listFixtures("calendar"),
        });
        return;
      }

      if (path === "/api/v1/system/integrations/todoist" && request.method === "PATCH") {
        const auth = authorizeRequest(request, response, store, apiKey, "operator");
        if (!auth) {
          return;
        }

        const body = await parseBody(request);
        sendJson(response, 200, store.patchIntegration("todoist", body, "admin_client"));
        return;
      }

      if (path === "/api/v1/system/integrations/todoist/sync" && request.method === "POST") {
        const auth = authorizeRequest(request, response, store, apiKey, "operator");
        if (!auth) {
          return;
        }

        const body = await parseBody(request);
        sendJson(response, 202, connectorSyncService.runSync("todoist", body));
        return;
      }

      if (path === "/api/v1/system/integrations/todoist/fixtures" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "viewer");
        if (!auth) {
          return;
        }

        sendJson(response, 200, {
          connector: "todoist",
          fixtures: connectorSyncService.listFixtures("todoist"),
        });
        return;
      }

      if (
        segments[0] === "api" &&
        segments[1] === "v1" &&
        segments[2] === "system" &&
        segments[3] === "integrations" &&
        segments[5] === "sync-jobs" &&
        request.method === "GET"
      ) {
        const auth = authorizeRequest(request, response, store, apiKey, "viewer");
        if (!auth) {
          return;
        }

        const job = connectorSyncService.getJob(segments[6] ?? "");
        if (!job) {
          sendJson(response, 404, {
            ok: false,
            error: {
              code: "SYNC_JOB_NOT_FOUND",
              message: "Sync job not found",
            },
          });
          return;
        }

        sendJson(response, 200, job);
        return;
      }

      if (path === "/api/v1/system/portable/bootstrap" && request.method === "GET") {
        const auth = resolveAuthContext(request, store, apiKey);
        if (!auth.ok) {
          sendJson(response, auth.status ?? 401, {
            ok: false,
            error: {
              code: auth.code ?? "UNAUTHORIZED",
              message: auth.message ?? "Unauthorized",
            },
          });
          return;
        }

        sendJson(response, 200, {
          ok: true,
          session: auth.session ?? null,
          capabilities: store.getCapabilities(),
          state: store.getSnapshot(),
          screenContext: createScreenContext(store.getSnapshot()),
          links: createSystemApiDescriptor().endpoints,
        });
        return;
      }

      if (path === "/api/v1/system/actions" && request.method === "POST") {
        const body = await parseBody(request);
        actionBody = body;
        const requiredRole = store.getRequiredRoleForAction(body.type) ?? "controller";
        const auth = resolveAuthContext(request, store, apiKey);
        if (!auth.ok) {
          sendActionError(
            response,
            auth.status ?? 401,
            body,
            auth.code ?? "UNAUTHORIZED",
            auth.message ?? "Unauthorized",
          );
          return;
        }

        if (!store.hasRequiredRole(auth.role, requiredRole)) {
          sendActionError(
            response,
            403,
            body,
            "FORBIDDEN",
            `Role ${auth.role} cannot execute ${body.type}`,
          );
          return;
        }
        const previousState = structuredClone(store.getSnapshot());
        const snapshot = store.runAction(body.type, body.payload ?? {}, body.source ?? "remote-client");
        sendActionResult(response, previousState, snapshot, body);
        return;
      }

      if (path === "/api/v1/system/pairing-codes" && request.method === "POST") {
        const auth = authorizeRequest(request, response, store, apiKey, "admin");
        if (!auth) {
          return;
        }

        const body = await parseBody(request);
        const pairing = store.createPairingCode(body, auth.kind === "api_key" ? "admin_client" : "system");
        sendJson(response, 201, pairing);
        return;
      }

      if (path === "/api/v1/system/pairing-codes/claim" && request.method === "POST") {
        const body = await parseBody(request);
        const session = store.claimPairingCode(body.code ?? "", body, body.source ?? "portable_controller");
        sendJson(response, 201, {
          ...session,
          stateUrl: "/api/v1/system/state",
          actionsUrl: "/api/v1/system/actions",
        });
        return;
      }

      if (path === "/api/v1/system/controller-sessions" && request.method === "POST") {
        const auth = authorizeRequest(request, response, store, apiKey, "admin");
        if (!auth) {
          return;
        }

        const body = await parseBody(request);
        const session = store.createSession(body, body.source ?? "portable_controller");
        sendJson(response, 201, {
          ...session,
          stateUrl: "/api/v1/system/state",
          actionsUrl: "/api/v1/system/actions",
        });
        return;
      }

      if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "system" && segments[3] === "controller-sessions") {
        if (segments[4] === "current" && request.method === "GET") {
          const auth = resolveAuthContext(request, store, apiKey);
          if (!auth.ok) {
            sendJson(response, auth.status ?? 401, {
              ok: false,
              error: {
                code: auth.code ?? "UNAUTHORIZED",
                message: auth.message ?? "Unauthorized",
              },
            });
            return;
          }

          if (!auth.session) {
            sendJson(response, 401, {
              ok: false,
              error: {
                code: "SESSION_REQUIRED",
                message: "Controller session required",
              },
            });
            return;
          }

          sendJson(response, 200, auth.session);
          return;
        }

        const auth = authorizeRequest(request, response, store, apiKey, "controller");
        if (!auth) {
          return;
        }

        const sessionId = segments[4];
        if (!sessionId) {
          sendJson(response, 404, { error: "Not found" });
          return;
        }

        if (request.method === "GET") {
          const session = store.getSession(sessionId);
          if (session && auth.kind === "controller_session" && auth.session?.id !== sessionId) {
            sendForbidden(response, "FORBIDDEN", "Controller sessions can only read themselves");
            return;
          }
          sendJson(response, session ? 200 : 404, session ?? { error: "Session not found" });
          return;
        }

        if (request.method === "DELETE") {
          if (auth.kind === "controller_session" && auth.session?.id !== sessionId) {
            sendForbidden(response, "FORBIDDEN", "Controller sessions can only revoke themselves");
            return;
          }
          const deleted = store.deleteSession(sessionId);
          sendJson(response, deleted ? 200 : 404, deleted ? { ok: true } : { error: "Session not found" });
          return;
        }
      }

      if (path === "/api/v1/flow/health" && request.method === "GET") {
        sendJson(response, 200, {
          ok: true,
          service: "tikpal-speaker-flow-api",
          time: new Date().toISOString(),
        });
        return;
      }

      if (path === "/api/v1/flow/openapi.json" && request.method === "GET") {
        sendJson(response, 200, flowOpenApiDocument);
        return;
      }

      if (path === "/api/v1/flow/state" && request.method === "GET") {
        sendJson(response, 200, store.getFlowSnapshot());
        return;
      }

      if (path === "/api/v1/flow/state" && request.method === "PATCH") {
        if (!isAuthorized(request, apiKey)) {
          sendUnauthorized(response);
          return;
        }

        const body = await parseBody(request);
        const snapshot = store.patchFlowState(body, body.source ?? "remote-client");
        sendJson(response, 200, snapshot);
        return;
      }

      if (path === "/api/v1/flow/actions" && request.method === "POST") {
        if (!isAuthorized(request, apiKey)) {
          sendUnauthorized(response);
          return;
        }

        const body = await parseBody(request);
        const snapshot = store.runFlowAction(body.type, body.payload ?? {}, body.source ?? "remote-client");
        sendJson(response, 200, snapshot);
        return;
      }

      if (path === "/api/v1/flow/controller-sessions" && request.method === "POST") {
        if (!isAuthorized(request, apiKey)) {
          sendUnauthorized(response);
          return;
        }

        const body = await parseBody(request);
        const session = store.createSession(body, body.source ?? "tikpal");
        sendJson(response, 201, {
          ...session,
          stateUrl: "/api/v1/flow/state",
          actionUrl: "/api/v1/flow/actions",
        });
        return;
      }

      if (segments[0] === "api" && segments[1] === "v1" && segments[2] === "flow" && segments[3] === "controller-sessions") {
        if (!isAuthorized(request, apiKey)) {
          sendUnauthorized(response);
          return;
        }

        const sessionId = segments[4];
        if (!sessionId) {
          sendJson(response, 404, { error: "Not found" });
          return;
        }

        if (request.method === "GET") {
          const session = store.getSession(sessionId);
          sendJson(response, session ? 200 : 404, session ?? { error: "Session not found" });
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
      const code = error instanceof Error && "code" in error ? error.code : null;
      if (
        code === "OTA_IN_PROGRESS" ||
        code === "INVALID_MODE" ||
        code === "INVALID_PANEL" ||
        code === "INVALID_FLOW_STATE" ||
        code === "NO_UPDATE_AVAILABLE" ||
        code === "ROLLBACK_UNAVAILABLE" ||
        code === "UNKNOWN_ACTION" ||
        code === "PAIRING_CODE_INVALID" ||
        code === "INVALID_CONNECTOR" ||
        code === "INVALID_FIXTURE" ||
        code?.startsWith("CALENDAR_") ||
        code?.startsWith("TODOIST_") ||
        code === "INVALID_VOICE_MOOD" ||
        code === "INVALID_CARE_MODE"
      ) {
        sendActionError(
          response,
          code === "OTA_IN_PROGRESS" ? 409 : 400,
          actionBody,
          code,
          error instanceof Error ? error.message : String(error),
        );
        return;
      }

      sendActionError(
        response,
        500,
        actionBody,
        code ?? "INTERNAL_SERVER_ERROR",
        error instanceof Error ? error.message : String(error),
      );
    }
  });
}

export function startServer({
  port = Number(process.env.TIKPAL_FLOW_API_PORT ?? 8787),
  host = process.env.TIKPAL_FLOW_API_HOST ?? "0.0.0.0",
  ...rest
} = {}) {
  const server = createAppServer(rest);
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      console.log(`tikpal-speaker System API listening on http://${host}:${port}/api/v1/system`);
      resolve(server);
    });
  });
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  await startServer();
}
