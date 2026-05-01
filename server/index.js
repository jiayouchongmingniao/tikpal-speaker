import http from "node:http";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { createConnectorAdapterRegistry, exchangeConnectorAuthorizationCode } from "./connectorAdapters.js";
import { createJsonFilePersistence } from "./localPersistence.js";
import { createJsonFileSecretStore } from "./localSecretStore.js";
import { createMockConnectorSyncService } from "./mockConnectorSyncService.js";
import { createFileSystemOtaManager } from "./otaReleaseManager.js";
import { combinedOpenApiDocument, flowOpenApiDocument, systemOpenApiDocument } from "./openapi.js";
import { createHttpPlayerAdapter, createMpcPlayerAdapter } from "./playerAdapter.js";
import { createDefaultPowerAdapter } from "./powerActionAdapter.js";
import { createScreenContext } from "./screenContextService.js";
import { createSystemStateStore } from "./systemStateStore.js";
import {
  getFlowSceneAudioLibraryPath,
  resolveFlowSceneSelection,
} from "../src/viewmodels/flowScenes.js";

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

function sendHtml(response, statusCode, html, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(html);
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

function isLoopbackAddress(address = "") {
  const normalized = String(address ?? "").trim();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "::ffff:127.0.0.1";
}

function isTrustedLocalUiRequest(request) {
  const localUiHeader = String(request.headers["x-tikpal-local-ui"] ?? "").trim();
  if (localUiHeader !== "1") {
    return false;
  }

  return isLoopbackAddress(request.socket?.remoteAddress);
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

  if (isTrustedLocalUiRequest(request)) {
    return {
      ok: true,
      role: "admin",
      kind: "trusted_local_ui",
      session: null,
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

function getPlayerErrorStatus(code) {
  if (code === "PLAYER_TIMEOUT") {
    return 504;
  }

  if (code === "PLAYER_INVALID_PAYLOAD") {
    return 502;
  }

  if (code === "PLAYER_HTTP_ERROR" || code === "PLAYER_NETWORK_ERROR") {
    return 502;
  }

  return 500;
}

function getPowerErrorStatus(code) {
  if (code === "POWER_ACTION_UNAVAILABLE") {
    return 503;
  }

  if (code === "POWER_ACTION_TIMEOUT") {
    return 504;
  }

  if (code === "POWER_INVALID_ACTION") {
    return 400;
  }

  return 500;
}

function createSwaggerHtml(specUrl = "/api/v1/openapi.json") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>tikpal-speaker Swagger</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body {
        margin: 0;
        background: #f6f7f9;
      }
      #swagger-ui {
        max-width: 1400px;
        margin: 0 auto;
      }
      .topbar {
        display: none;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specUrl)},
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        docExpansion: "list",
        defaultModelsExpandDepth: 1,
      });
    </script>
  </body>
</html>`;
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
      swagger: "/swagger",
      unifiedOpenapi: "/api/v1/openapi.json",
      health: "/api/v1/system/health",
      openapi: "/api/v1/system/openapi.json",
      state: "/api/v1/system/state",
      capabilities: "/api/v1/system/capabilities",
      screenContext: "/api/v1/system/screen/context",
      runtimeSummary: "/api/v1/system/runtime/summary",
      runtimeProfile: "/api/v1/system/runtime/profile",
      runtimeActionLog: "/api/v1/system/runtime/action-log",
      runtimeStateTransitions: "/api/v1/system/runtime/state-transitions",
      runtimePerformanceSamples: "/api/v1/system/runtime/performance-samples",
      otaStatus: "/api/v1/system/ota/status",
      otaCheck: "/api/v1/system/ota/check",
      otaApply: "/api/v1/system/ota/apply",
      otaRollback: "/api/v1/system/ota/rollback",
      actions: "/api/v1/system/actions",
      flowSceneActions: {
        nextScene: "POST /api/v1/system/actions next_flow_scene",
        setScene: "POST /api/v1/system/actions set_flow_scene",
      },
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

function createDefaultPlayerAdapter() {
  const backend = String(process.env.TIKPAL_PLAYER_BACKEND ?? "").trim().toLowerCase();
  const hasMpdConfig = Boolean(process.env.TIKPAL_MPD_HOST || process.env.TIKPAL_MPD_PORT);

  if (backend === "mpc") {
    return createMpcPlayerAdapter();
  }

  if (backend === "http") {
    return process.env.TIKPAL_PLAYER_API_BASE ? createHttpPlayerAdapter() : null;
  }

  if (process.env.TIKPAL_PLAYER_API_BASE) {
    return createHttpPlayerAdapter();
  }

  if (hasMpdConfig) {
    return createMpcPlayerAdapter();
  }

  return null;
}

function createSystemPowerAdapter() {
  return createDefaultPowerAdapter();
}

const FLOW_SCENE_PLAYBACK_ACTION_TYPES = new Set([
  "set_mode",
  "set_flow_state",
  "next_flow_scene",
  "prev_flow_scene",
  "set_flow_scene",
]);

function resolveCurrentFlowSceneMedia(snapshot, libraryRoot = process.env.TIKPAL_FLOW_SCENE_AUDIO_ROOT ?? "Codex/flow-scenes-audio") {
  if (!snapshot?.flow || snapshot.activeMode !== "flow") {
    return null;
  }

  const selection = resolveFlowSceneSelection({
    flowState: snapshot.flow.state,
    sceneId: snapshot.flow.sceneId,
    sceneIndex: snapshot.flow.sceneIndex,
    scenesByState: snapshot.flow.scenesByState,
  });
  return {
    scene: selection.scene,
    mediaPath: getFlowSceneAudioLibraryPath(selection.scene, libraryRoot),
  };
}

export function createAppServer({
  store = createDefaultSystemStateStore(),
  connectorSyncService = createDefaultConnectorSyncService(store),
  connectorTokenExchange = exchangeConnectorAuthorizationCode,
  playerAdapter = createDefaultPlayerAdapter(),
  powerAdapter = createSystemPowerAdapter(),
  apiKey = process.env.TIKPAL_API_KEY ?? "",
  allowedOrigins = new Set(
    (process.env.TIKPAL_ALLOWED_ORIGINS ??
      "https://tikpal.ai,https://www.tikpal.ai,http://localhost:4173,http://localhost:3000")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ),
  playerSyncIntervalMs = Number(process.env.TIKPAL_PLAYER_SYNC_INTERVAL_MS ?? 5000),
} = {}) {
  async function enrichPlaybackAction(type, payload = {}) {
    if (!playerAdapter) {
      return payload;
    }

    const snapshot = store.getSnapshot();
    if (["toggle_play", "set_volume", "next_track", "prev_track"].includes(type)) {
      const playerState = await playerAdapter.runAction(type, payload, snapshot.playback);
      return {
        ...payload,
        playerState,
      };
    }

    return {
      ...payload,
    };
  }

  function shouldRunFlowScenePlaybackAfterState(type, payload = {}) {
    return (
      playerAdapter?.mode === "mpc" &&
      FLOW_SCENE_PLAYBACK_ACTION_TYPES.has(type) &&
      !(type === "set_mode" && payload.mode !== "flow")
    );
  }

  async function syncFlowScenePlaybackAfterState(snapshot) {
    if (!playerAdapter) {
      return;
    }

    const flowSceneMedia = resolveCurrentFlowSceneMedia(snapshot);
    if (!flowSceneMedia?.mediaPath) {
      return;
    }

    const playerState = await playerAdapter.runAction("play_media", { mediaPath: flowSceneMedia.mediaPath }, snapshot.playback);
    store.patchPlaybackState(playerState, "flow_scene_playback");
  }
  const appServer = http.createServer(async (request, response) => {
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
      if ((path === "/swagger" || path === "/api-docs" || path === "/api/v1/swagger") && request.method === "GET") {
        sendHtml(response, 200, createSwaggerHtml("/api/v1/openapi.json"));
        return;
      }

      if (path === "/api/v1/openapi.json" && request.method === "GET") {
        sendJson(response, 200, combinedOpenApiDocument);
        return;
      }

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

      if (path === "/api/v1/system/runtime/profile" && request.method === "GET") {
        const auth = authorizeRequest(request, response, store, apiKey, "operator");
        if (!auth) {
          return;
        }

        sendJson(response, 200, store.getRuntimeProfile());
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
        const actionSource = body.source ?? "remote-client";
        if (shouldRunFlowScenePlaybackAfterState(body.type, body.payload ?? {})) {
          const snapshot = store.runAction(body.type, body.payload ?? {}, actionSource);
          sendActionResult(response, previousState, snapshot, body);
          void syncFlowScenePlaybackAfterState(snapshot).catch(() => {
            // Playback will be retried by the next explicit Flow scene action or passive player sync.
          });
          return;
        }

        let enrichedPayload = body.payload ?? {};
        try {
          enrichedPayload = await enrichPlaybackAction(body.type, body.payload ?? {});
        } catch (error) {
          const code = error instanceof Error && "code" in error ? error.code : "PLAYER_ACTION_FAILED";
          sendActionError(
            response,
            getPlayerErrorStatus(code),
            body,
            code,
            error instanceof Error ? error.message : String(error),
          );
          return;
        }
        if (["system_reboot", "system_shutdown"].includes(body.type)) {
          try {
            if (!powerAdapter) {
              const error = new Error(`System power action is not configured for ${body.type}`);
              error.code = "POWER_ACTION_UNAVAILABLE";
              throw error;
            }

            await powerAdapter.runAction(body.type, body.payload ?? {});
          } catch (error) {
            const code = error instanceof Error && "code" in error ? error.code : "POWER_ACTION_FAILED";
            sendActionError(
              response,
              getPowerErrorStatus(code),
              body,
              code,
              error instanceof Error ? error.message : String(error),
            );
            return;
          }
        }
        const snapshot = store.runAction(body.type, enrichedPayload, actionSource);
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
        code === "INVALID_CARE_MODE" ||
        code === "PLAYER_HTTP_ERROR" ||
        code === "PLAYER_TIMEOUT" ||
        code === "PLAYER_INVALID_PAYLOAD" ||
        code === "PLAYER_NETWORK_ERROR" ||
        code === "POWER_ACTION_UNAVAILABLE" ||
        code === "POWER_ACTION_TIMEOUT" ||
        code === "POWER_ACTION_FAILED" ||
        code === "POWER_INVALID_ACTION"
      ) {
        sendActionError(
          response,
          code === "OTA_IN_PROGRESS"
            ? 409
            : code?.startsWith("PLAYER_")
              ? getPlayerErrorStatus(code)
              : code?.startsWith("POWER_")
                ? getPowerErrorStatus(code)
                : 400,
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

  if (playerAdapter?.getStatus) {
    let playerSyncTimer = null;
    let syncing = false;

    async function syncPlayerState() {
      if (syncing) {
        return;
      }

      syncing = true;
      try {
        const nextPlayback = await playerAdapter.getStatus({});
        store.patchPlaybackState(nextPlayback, "player_sync");
      } catch {
        // Keep the last good playback snapshot until the adapter becomes reachable again.
      } finally {
        syncing = false;
      }
    }

    void syncPlayerState();

    if (playerSyncIntervalMs > 0) {
      playerSyncTimer = setInterval(() => {
        void syncPlayerState();
      }, playerSyncIntervalMs);
    }

    appServer.on("close", () => {
      if (playerSyncTimer) {
        clearInterval(playerSyncTimer);
      }
    });
  }

  return appServer;
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
