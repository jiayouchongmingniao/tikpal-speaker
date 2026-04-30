const commonSchemas = {
  Mode: {
    type: "string",
    enum: ["overview", "listen", "flow", "screen"],
  },
  FocusPanel: {
    type: "string",
    enum: ["listen", "flow", "screen"],
  },
  Role: {
    type: "string",
    enum: ["viewer", "controller", "operator", "admin"],
  },
  ControlSource: {
    type: "string",
    enum: ["touch", "remote", "portable_controller", "api", "system", "speaker-ui", "remote-client"],
  },
  FlowState: {
    type: "string",
    enum: ["focus", "flow", "relax", "sleep"],
  },
  CreativeMood: {
    type: "string",
    enum: ["clear", "scattered", "stuck", "tired", "calm", "energized"],
  },
  CreativeCareMode: {
    type: "string",
    enum: ["focus", "flow", "unwind", "sleep"],
  },
  PlaybackState: {
    type: "string",
    enum: ["play", "pause", "stop"],
  },
  PlayerState: {
    type: "object",
    properties: {
      playbackState: { $ref: "#/components/schemas/PlaybackState" },
      volume: { type: "number", minimum: 0, maximum: 100 },
      trackTitle: { type: "string" },
      artist: { type: "string" },
      source: { type: "string" },
      progress: { type: "number", minimum: 0, maximum: 1 },
    },
  },
};

export const flowOpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "tikpal-speaker Flow Control API",
    version: "1.0.0",
    description: "Legacy Flow REST API mapped onto the system state store.",
  },
  servers: [{ url: "/api/v1/flow" }],
  components: {
    securitySchemes: {
      tikpalApiKey: {
        type: "apiKey",
        in: "header",
        name: "X-Tikpal-Key",
      },
    },
    schemas: {
      ...commonSchemas,
      FlowSnapshot: {
        type: "object",
        properties: {
          currentState: { $ref: "#/components/schemas/FlowState" },
          uiVisible: { type: "boolean" },
          appPhase: { type: "string" },
          playerState: { $ref: "#/components/schemas/PlayerState" },
          audioMetrics: { type: "object" },
          updatedAt: { type: "string", format: "date-time" },
          lastSource: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: { 200: { description: "Service is up" } },
      },
    },
    "/openapi.json": {
      get: {
        summary: "Read the Flow OpenAPI document",
        responses: {
          200: {
            description: "OpenAPI document for the Flow API",
          },
        },
      },
    },
    "/state": {
      get: {
        summary: "Read the latest Flow snapshot",
        responses: {
          200: {
            description: "Current snapshot",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FlowSnapshot" },
              },
            },
          },
        },
      },
      patch: {
        summary: "Patch the current Flow snapshot",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  currentState: { $ref: "#/components/schemas/FlowState" },
                  uiVisible: { type: "boolean" },
                  appPhase: { type: "string" },
                  playerState: { $ref: "#/components/schemas/PlayerState" },
                  audioMetrics: { type: "object" },
                  source: { $ref: "#/components/schemas/ControlSource" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Patched Flow snapshot",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FlowSnapshot" },
              },
            },
          },
        },
      },
    },
    "/actions": {
      post: {
        summary: "Trigger a Flow control action",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type"],
                properties: {
                  type: { type: "string" },
                  payload: { type: "object" },
                  source: { $ref: "#/components/schemas/ControlSource" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated snapshot after action",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FlowSnapshot" },
              },
            },
          },
        },
      },
    },
    "/controller-sessions": {
      post: {
        summary: "Create a Flow controller session",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  deviceId: { type: "string" },
                  name: { type: "string" },
                  role: { $ref: "#/components/schemas/Role" },
                  capabilities: {
                    type: "array",
                    items: { type: "string" },
                  },
                  ttlSec: { type: "number", minimum: 0 },
                  source: { $ref: "#/components/schemas/ControlSource" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Created controller session",
          },
        },
      },
    },
    "/controller-sessions/{sessionId}": {
      get: {
        summary: "Read a Flow controller session",
        security: [{ tikpalApiKey: [] }],
        parameters: [
          {
            in: "path",
            name: "sessionId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Controller session snapshot",
          },
          404: {
            description: "Session not found",
          },
        },
      },
      delete: {
        summary: "Revoke a Flow controller session",
        security: [{ tikpalApiKey: [] }],
        parameters: [
          {
            in: "path",
            name: "sessionId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Session revoked",
          },
          404: {
            description: "Session not found",
          },
        },
      },
    },
  },
};

export const systemOpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "tikpal-speaker System API",
    version: "1.0.0",
    description: "System-level REST API for Overview, Listen, Flow, Screen, portable controllers, and OTA-aware device control.",
  },
  servers: [{ url: "/api/v1/system" }],
  components: {
    securitySchemes: {
      tikpalApiKey: {
        type: "apiKey",
        in: "header",
        name: "X-Tikpal-Key",
      },
    },
    schemas: {
      ...commonSchemas,
      SystemState: {
        type: "object",
        properties: {
          activeMode: {
            $ref: "#/components/schemas/Mode",
          },
          focusedPanel: {
            type: ["string", "null"],
            enum: ["listen", "flow", "screen", null],
          },
          overlay: { type: "object" },
          playback: { type: "object" },
          flow: { type: "object" },
          screen: { $ref: "#/components/schemas/ScreenState" },
          creativeCare: { $ref: "#/components/schemas/CreativeCareState" },
          system: { type: "object" },
          lastSource: { type: "string" },
          lastUpdatedAt: { type: "string", format: "date-time" },
        },
      },
      ScreenState: {
        type: "object",
        properties: {
          currentTask: { type: "string" },
          nextTask: { type: "string" },
          currentBlockTitle: { type: "string" },
          pomodoroState: { type: "string", enum: ["idle", "running", "paused", "break"] },
          pomodoroFocusTask: { type: "string" },
          pomodoroDurationSec: { type: "number" },
          pomodoroRemainingSec: { type: "number" },
          completedPomodoros: { type: "number" },
          timerUpdatedAt: { type: "string", format: "date-time" },
          todaySummary: { type: "object" },
          sync: { type: "object" },
        },
      },
      CreativeCareState: {
        type: "object",
        properties: {
          latestTranscript: { type: "string" },
          moodLabel: { $ref: "#/components/schemas/CreativeMood" },
          moodIntensity: { type: "number", minimum: 0, maximum: 1 },
          inspirationSummary: { type: "string" },
          suggestedFlowState: { $ref: "#/components/schemas/FlowState" },
          currentCareMode: { $ref: "#/components/schemas/CreativeCareMode" },
          insightSentence: { type: "string" },
          updatedAt: { type: ["string", "null"], format: "date-time" },
          metadata: {
            type: "object",
            properties: {
              source: { type: "string" },
              captureLength: { type: "number" },
            },
          },
        },
      },
      ScreenContext: {
        type: "object",
        properties: {
          now: { type: "string", format: "date-time" },
          focusItem: { type: ["object", "null"] },
          currentBlock: { type: ["object", "null"] },
          nextBlock: { type: ["object", "null"] },
          pomodoro: { type: "object" },
          todaySummary: { type: "object" },
          sync: { type: "object" },
        },
      },
      ConnectorStatus: {
        type: "object",
        properties: {
          connected: { type: "boolean" },
          accountLabel: { type: ["string", "null"] },
          credentialRef: { type: ["string", "null"] },
          authUpdatedAt: { type: ["string", "null"], format: "date-time" },
          status: { type: "string" },
          lastSyncAt: { type: ["string", "null"], format: "date-time" },
          lastErrorCode: { type: ["string", "null"] },
          lastErrorMessage: { type: ["string", "null"] },
        },
      },
      ConnectorStatusList: {
        type: "object",
        properties: {
          items: {
            type: "object",
            properties: {
              calendar: { $ref: "#/components/schemas/ConnectorStatus" },
              todoist: { $ref: "#/components/schemas/ConnectorStatus" },
            },
          },
        },
      },
      ConnectorConnectRequest: {
        type: "object",
        properties: {
          accountLabel: { type: "string" },
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
          tokenExpiresAt: { type: "string", format: "date-time" },
          authorizationCode: { type: "string" },
          code: { type: "string" },
          redirectUri: { type: "string" },
          codeVerifier: { type: "string" },
          metadata: { type: "object" },
        },
      },
      CalendarIntegrationPatch: {
        allOf: [
          { $ref: "#/components/schemas/ConnectorStatus" },
          {
            type: "object",
            properties: {
              currentEvent: { type: ["object", "null"] },
              nextEvent: { type: ["object", "null"] },
              remainingEvents: { type: "number" },
            },
          },
        ],
      },
      TodoistIntegrationPatch: {
        allOf: [
          { $ref: "#/components/schemas/ConnectorStatus" },
          {
            type: "object",
            properties: {
              currentTask: { type: ["object", "null"] },
              nextTask: { type: ["object", "null"] },
              remainingTasks: { type: "number" },
            },
          },
        ],
      },
      ConnectorSyncRequest: {
        type: "object",
        properties: {
          scenario: {
            type: "string",
            enum: ["success", "stale", "error"],
          },
          fixture: {
            type: "string",
          },
          delayMs: {
            type: "number",
            minimum: 0,
          },
        },
      },
      ConnectorSyncJob: {
        type: "object",
        properties: {
          id: { type: "string" },
          connector: { type: "string", enum: ["calendar", "todoist"] },
          scenario: { type: "string" },
          fixture: { type: "string" },
          startedAt: { type: "string", format: "date-time" },
          finishedAt: { type: ["string", "null"], format: "date-time" },
          status: { type: "string" },
        },
      },
      ConnectorFixtureList: {
        type: "object",
        properties: {
          connector: { type: "string", enum: ["calendar", "todoist"] },
          fixtures: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      RuntimeSummary: {
        type: "object",
        properties: {
          activeMode: { type: ["string", "null"] },
          focusedPanel: { type: ["string", "null"] },
          overlay: { type: ["string", "null"] },
          playbackState: { type: ["string", "null"] },
          playbackSource: { type: ["string", "null"] },
          playbackVolume: { type: ["number", "null"] },
          flowState: { type: ["string", "null"] },
          pomodoroState: { type: ["string", "null"] },
          screenTask: { type: ["string", "null"] },
          creativeMood: { type: ["string", "null"] },
          creativeCareMode: { type: ["string", "null"] },
          creativeFlowSuggestion: { type: ["string", "null"] },
          performanceTier: { type: ["string", "null"] },
          renderProfile: { type: "string", enum: ["off", "balanced", "stable"] },
          flowDiagnosticMode: { type: "string", enum: ["off", "static"] },
          avgFps: { type: ["number", "null"] },
          rendererType: { type: "string", enum: ["canvas", "webgl"] },
          requestedRenderer: { type: "string", enum: ["canvas", "auto", "webgl"] },
          chromiumExperiment: { type: "string" },
          rendererFallbackCount: { type: "number" },
          glInitErrorCount: { type: "number" },
          glContextLostCount: { type: "number" },
          rendererFallbackReason: { type: ["string", "null"] },
          temperatureC: { type: ["number", "null"] },
          interactionLatencyMs: { type: ["number", "null"] },
          memoryUsageMb: { type: ["number", "null"] },
          lastDegradeReason: { type: ["string", "null"] },
          tierDecisionReason: { type: ["string", "null"] },
          tierCooldownUntil: { type: ["number", "null"] },
          tierCooldownRemainingMs: { type: "number" },
          performanceTierUpdatedAt: { type: ["string", "null"], format: "date-time" },
          otaStatus: { type: ["string", "null"] },
          lastSource: { type: ["string", "null"] },
          controllerCount: { type: "number" },
          screenSyncStale: { type: "boolean" },
          lastUpdatedAt: { type: ["string", "null"], format: "date-time" },
        },
      },
      RuntimeProfile: {
        type: "object",
        properties: {
          renderProfile: { type: "string", enum: ["off", "balanced", "stable"] },
          flowDiagnosticMode: { type: "string", enum: ["off", "static"] },
          rendererType: { type: "string", enum: ["canvas", "webgl"] },
          requestedRenderer: { type: "string", enum: ["canvas", "auto", "webgl"] },
          chromiumExperiment: { type: "string" },
          rendererFallbackReason: { type: ["string", "null"] },
          activeTier: { type: "string", enum: ["normal", "reduced", "safe"] },
          activeBudget: { type: "object" },
          tiers: { type: "object" },
          tierPolicy: { type: "object" },
        },
      },
      RuntimeActionLogEntry: {
        type: "object",
        properties: {
          timestamp: { type: "string", format: "date-time" },
          source: { type: "string" },
          actionType: { type: "string" },
          payloadSummary: { type: ["object", "null"] },
          result: { type: "string", enum: ["applied", "ignored", "rejected"] },
          errorCode: { type: ["string", "null"] },
          durationMs: { type: "number" },
        },
      },
      RuntimeStateTransitionLogEntry: {
        type: "object",
        properties: {
          timestamp: { type: "string", format: "date-time" },
          source: { type: "string" },
          reasonAction: { type: ["string", "null"] },
          from: { type: "object" },
          to: { type: "object" },
        },
      },
      RuntimeLogList: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "object" },
          },
        },
      },
      OtaStatus: {
        type: "object",
        properties: {
          currentVersion: { type: "string" },
          previousVersion: { type: ["string", "null"] },
          targetVersion: { type: ["string", "null"] },
          updateAvailable: { type: "boolean" },
          canRollback: { type: "boolean" },
          releaseRoot: { type: "string" },
          currentPath: { type: "string" },
          previousPath: { type: "string" },
          restartRequired: { type: "boolean" },
          lastCheckedAt: { type: ["string", "null"], format: "date-time" },
          lastAppliedAt: { type: ["string", "null"], format: "date-time" },
          lastRestartedAt: { type: ["string", "null"], format: "date-time" },
          lastHealthCheckAt: { type: ["string", "null"], format: "date-time" },
          lastRolledBackAt: { type: ["string", "null"], format: "date-time" },
          lastErrorCode: { type: ["string", "null"] },
          lastOperation: { type: ["object", "null"] },
        },
      },
      OtaActionRequest: {
        type: "object",
        properties: {
          targetVersion: { type: "string" },
          source: { $ref: "#/components/schemas/ControlSource" },
          requestId: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      ActionRequest: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            type: "string",
            enum: [
              "set_mode",
              "return_overview",
              "focus_panel",
              "next_mode",
              "prev_mode",
              "show_controls",
              "hide_controls",
              "toggle_play",
              "prev_track",
              "next_track",
              "set_volume",
              "set_flow_state",
              "screen_start_pomodoro",
              "screen_resume_pomodoro",
              "screen_pause_pomodoro",
              "screen_reset_pomodoro",
              "screen_complete_current_task",
              "screen_set_focus_item",
              "voice_capture_submit",
              "voice_mood_set",
              "voice_care_mode_set",
              "voice_reflection_clear",
              "runtime_set_performance_tier",
              "runtime_report_performance",
              "ota_check",
              "ota_apply",
              "ota_rollback",
              "system_reboot",
              "system_shutdown",
            ],
          },
          payload: { type: "object" },
          source: { $ref: "#/components/schemas/ControlSource" },
          requestId: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      ActionResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          result: {
            type: "string",
            enum: ["applied", "ignored", "rejected"],
          },
          state: { $ref: "#/components/schemas/SystemState" },
          appliedAction: {
            type: "object",
            properties: {
              type: { type: "string" },
              requestId: { type: ["string", "null"] },
              timestamp: { type: ["string", "null"], format: "date-time" },
            },
          },
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
      SystemCapabilities: {
        type: "object",
        properties: {
          modes: {
            type: "array",
            items: { $ref: "#/components/schemas/Mode" },
          },
          flowStates: {
            type: "array",
            items: { $ref: "#/components/schemas/FlowState" },
          },
          touch: { type: "object" },
          screenFeatures: { type: "object" },
          creativeCare: { type: "object" },
          integrations: { type: "object" },
          ota: { type: "object" },
          performance: { type: "object" },
          auth: { type: "object" },
          controllerSessions: { type: "object" },
        },
      },
      ControllerSessionRequest: {
        type: "object",
        properties: {
          deviceId: { type: "string" },
          name: { type: "string" },
          role: { $ref: "#/components/schemas/Role" },
          capabilities: {
            type: "array",
            items: { type: "string" },
          },
          ttlSec: { type: "number", minimum: 0 },
        },
      },
      PairingCodeRequest: {
        type: "object",
        properties: {
          role: { $ref: "#/components/schemas/Role" },
          capabilities: {
            type: "array",
            items: { type: "string" },
          },
          ttlSec: { type: "number", minimum: 0 },
        },
      },
      PairingCode: {
        type: "object",
        properties: {
          code: { type: "string" },
          role: { $ref: "#/components/schemas/Role" },
          capabilities: {
            type: "array",
            items: { type: "string" },
          },
          createdAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time" },
          claimedAt: { type: ["string", "null"], format: "date-time" },
        },
      },
      PairingCodeClaimRequest: {
        type: "object",
        required: ["code"],
        properties: {
          code: { type: "string" },
          deviceId: { type: "string" },
          name: { type: "string" },
          capabilities: {
            type: "array",
            items: { type: "string" },
          },
          ttlSec: { type: "number", minimum: 0 },
          source: { $ref: "#/components/schemas/ControlSource" },
        },
      },
      ControllerSession: {
        type: "object",
        properties: {
          id: { type: "string" },
          deviceId: { type: "string" },
          name: { type: "string" },
          role: { $ref: "#/components/schemas/Role" },
          scopes: {
            type: "array",
            items: { type: "string" },
          },
          capabilities: {
            type: "array",
            items: { type: "string" },
          },
          source: { $ref: "#/components/schemas/ControlSource" },
          createdAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time" },
          lastSeenAt: { type: ["string", "null"], format: "date-time" },
          revoked: { type: "boolean" },
          token: { type: ["string", "null"] },
          stateUrl: { type: "string" },
          actionsUrl: { type: "string" },
        },
      },
      SystemApiDescriptor: {
        type: "object",
        properties: {
          service: { type: "string" },
          version: { type: "string" },
          auth: { type: "object" },
          endpoints: { type: "object" },
        },
      },
      PortableBootstrapResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          session: {
            oneOf: [{ $ref: "#/components/schemas/ControllerSession" }, { type: "null" }],
          },
          capabilities: { $ref: "#/components/schemas/SystemCapabilities" },
          state: { $ref: "#/components/schemas/SystemState" },
          screenContext: { $ref: "#/components/schemas/ScreenContext" },
          links: { type: "object" },
        },
      },
    },
  },
  paths: {
    "/": {
      get: {
        summary: "Describe the System API surface for external clients",
        responses: {
          200: {
            description: "System API descriptor",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemApiDescriptor" },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        summary: "Health check",
        responses: { 200: { description: "Service is up" } },
      },
    },
    "/state": {
      get: {
        summary: "Read the current system snapshot",
        responses: {
          200: {
            description: "Current system state",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemState" },
              },
            },
          },
        },
      },
    },
    "/capabilities": {
      get: {
        summary: "Read the current device capabilities",
        responses: {
          200: {
            description: "Capabilities snapshot",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemCapabilities" },
              },
            },
          },
        },
      },
    },
    "/screen/context": {
      get: {
        summary: "Read the normalized ScreenContext snapshot",
        responses: {
          200: {
            description: "Normalized ScreenContext for Screen surfaces and portable clients",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScreenContext" },
              },
            },
          },
        },
      },
    },
    "/runtime/summary": {
      get: {
        summary: "Read the current runtime summary for debug panels",
        responses: {
          200: {
            description: "Runtime summary",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RuntimeSummary" },
              },
            },
          },
        },
      },
    },
    "/runtime/profile": {
      get: {
        summary: "Read render profile and effective per-tier budgets",
        responses: {
          200: {
            description: "Runtime render profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RuntimeProfile" },
              },
            },
          },
        },
      },
    },
    "/runtime/action-log": {
      get: {
        summary: "Read recent action log entries",
        responses: {
          200: {
            description: "Recent action logs",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RuntimeLogList" },
              },
            },
          },
        },
      },
    },
    "/runtime/state-transitions": {
      get: {
        summary: "Read recent state transition log entries",
        responses: {
          200: {
            description: "Recent state transition logs",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RuntimeLogList" },
              },
            },
          },
        },
      },
    },
    "/runtime/performance-samples": {
      get: {
        summary: "Read recent performance telemetry samples",
        responses: {
          200: {
            description: "Recent performance samples",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RuntimeLogList" },
              },
            },
          },
        },
      },
    },
    "/ota/status": {
      get: {
        summary: "Read current OTA status and version pointers",
        responses: {
          200: {
            description: "OTA status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OtaStatus" },
              },
            },
          },
        },
      },
    },
    "/ota/check": {
      post: {
        summary: "Check for an available application OTA release",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OtaActionRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "OTA check result and updated system state",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActionResponse" },
              },
            },
          },
        },
      },
    },
    "/ota/apply": {
      post: {
        summary: "Apply the staged application OTA release and run a health-check pass",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OtaActionRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "OTA apply result and updated system state",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActionResponse" },
              },
            },
          },
          400: {
            description: "No available OTA release can be applied",
          },
          409: {
            description: "OTA is already applying or rolling back",
          },
        },
      },
    },
    "/ota/rollback": {
      post: {
        summary: "Rollback to the previous application OTA release and run a health-check pass",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OtaActionRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "OTA rollback result and updated system state",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActionResponse" },
              },
            },
          },
          400: {
            description: "No rollback release is available",
          },
          409: {
            description: "OTA is already applying or rolling back",
          },
        },
      },
    },
    "/integrations": {
      get: {
        summary: "Read connector binding and sync statuses for the admin surface",
        security: [{ tikpalApiKey: [] }],
        responses: {
          200: {
            description: "Connector statuses without provider tokens",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConnectorStatusList" },
              },
            },
          },
        },
      },
    },
    "/integrations/{connector}/connect": {
      post: {
        summary: "Bind a connector credential in service-owned storage",
        security: [{ tikpalApiKey: [] }],
        parameters: [
          {
            name: "connector",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["calendar", "todoist"] },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ConnectorConnectRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Updated system state after connector binding",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemState" },
              },
            },
          },
        },
      },
    },
    "/integrations/{connector}": {
      delete: {
        summary: "Disconnect a connector and revoke its service-owned credential",
        security: [{ tikpalApiKey: [] }],
        parameters: [
          {
            name: "connector",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["calendar", "todoist"] },
          },
        ],
        responses: {
          200: {
            description: "Updated system state after connector disconnect",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SystemState" },
              },
            },
          },
        },
      },
    },
    "/integrations/{connector}/refresh": {
      post: {
        summary: "Trigger a connector refresh through the sync worker",
        security: [{ tikpalApiKey: [] }],
        parameters: [
          {
            name: "connector",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["calendar", "todoist"] },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ConnectorSyncRequest" },
            },
          },
        },
        responses: {
          202: {
            description: "Accepted connector refresh job",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConnectorSyncJob" },
              },
            },
          },
          409: {
            description: "Connector is not bound yet",
          },
        },
      },
    },
    "/integrations/calendar": {
      patch: {
        summary: "Patch mock Calendar connector state for ScreenContext validation",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CalendarIntegrationPatch" },
            },
          },
        },
        responses: {
          200: {
            description: "Updated system state with patched Calendar connector",
          },
        },
      },
    },
    "/integrations/calendar/sync": {
      post: {
        summary: "Trigger a mock Calendar sync worker run",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ConnectorSyncRequest" },
            },
          },
        },
        responses: {
          202: {
            description: "Accepted mock sync job",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConnectorSyncJob" },
              },
            },
          },
        },
      },
    },
    "/integrations/calendar/fixtures": {
      get: {
        summary: "List available mock Calendar fixtures",
        responses: {
          200: {
            description: "Available fixture names for Calendar mock sync",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConnectorFixtureList" },
              },
            },
          },
        },
      },
    },
    "/integrations/todoist": {
      patch: {
        summary: "Patch mock Todoist connector state for ScreenContext validation",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TodoistIntegrationPatch" },
            },
          },
        },
        responses: {
          200: {
            description: "Updated system state with patched Todoist connector",
          },
        },
      },
    },
    "/integrations/todoist/fixtures": {
      get: {
        summary: "List available mock Todoist fixtures",
        responses: {
          200: {
            description: "Available fixture names for Todoist mock sync",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConnectorFixtureList" },
              },
            },
          },
        },
      },
    },
    "/integrations/todoist/sync": {
      post: {
        summary: "Trigger a mock Todoist sync worker run",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ConnectorSyncRequest" },
            },
          },
        },
        responses: {
          202: {
            description: "Accepted mock sync job",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConnectorSyncJob" },
              },
            },
          },
        },
      },
    },
    "/integrations/{connector}/sync-jobs/{jobId}": {
      get: {
        summary: "Read mock connector sync job status",
        parameters: [
          {
            name: "connector",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: ["calendar", "todoist"],
            },
          },
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Sync job status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConnectorSyncJob" },
              },
            },
          },
        },
      },
    },
    "/portable/bootstrap": {
      get: {
        summary: "Bootstrap a portable device with links, state, capabilities and current session",
        responses: {
          200: {
            description: "Portable bootstrap payload",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PortableBootstrapResponse" },
              },
            },
          },
          401: {
            description: "Provided session token is invalid or expired",
          },
        },
      },
    },
    "/actions": {
      post: {
        summary: "Trigger a system-level action",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ActionRequest" },
              examples: {
                focusPanel: {
                  summary: "Move overview focus without entering the mode",
                  value: {
                    type: "focus_panel",
                    payload: { panel: "screen" },
                    source: "remote",
                    requestId: "req_focus_screen",
                    timestamp: "2026-04-21T12:00:00Z",
                  },
                },
                nextMode: {
                  summary: "Move to the next focus mode",
                  value: {
                    type: "next_mode",
                    payload: {},
                    source: "touch",
                  },
                },
                screenStartPomodoro: {
                  summary: "Start a pomodoro for the current screen task",
                  value: {
                    type: "screen_start_pomodoro",
                    payload: { durationSec: 1500 },
                    source: "portable_controller",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Action result and updated system state",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActionResponse" },
              },
            },
          },
          409: {
            description: "Action rejected in the current system phase",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActionResponse" },
              },
            },
          },
          400: {
            description: "Action request is invalid",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActionResponse" },
              },
            },
          },
          500: {
            description: "Unexpected server-side failure while applying the action",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ActionResponse" },
              },
            },
          },
        },
      },
    },
    "/controller-sessions": {
      post: {
        summary: "Create a controller session for portable access",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ControllerSessionRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Controller session created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ControllerSession" },
              },
            },
          },
          403: {
            description: "Only admin credentials can create controller sessions",
          },
        },
      },
    },
    "/pairing-codes": {
      post: {
        summary: "Create a short-lived pairing code for portable onboarding",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PairingCodeRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Pairing code created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PairingCode" },
              },
            },
          },
        },
      },
    },
    "/pairing-codes/claim": {
      post: {
        summary: "Claim a pairing code and mint a controller session",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PairingCodeClaimRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Controller session created from pairing code",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ControllerSession" },
              },
            },
          },
          400: {
            description: "Pairing code is invalid or expired",
          },
        },
      },
    },
    "/controller-sessions/{sessionId}": {
      get: {
        summary: "Read a controller session",
        security: [{ tikpalApiKey: [] }],
        parameters: [
          {
            in: "path",
            name: "sessionId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Controller session snapshot",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ControllerSession" },
              },
            },
          },
          403: {
            description: "Only the current session or admin can read this resource",
          },
          404: {
            description: "Session not found",
          },
        },
      },
      delete: {
        summary: "Revoke a controller session",
        security: [{ tikpalApiKey: [] }],
        parameters: [
          {
            in: "path",
            name: "sessionId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Session revoked",
          },
          403: {
            description: "Only the current session or admin can revoke this resource",
          },
          404: {
            description: "Session not found",
          },
        },
      },
    },
    "/controller-sessions/current": {
      get: {
        summary: "Read the currently authenticated controller session",
        security: [{ tikpalApiKey: [] }],
        responses: {
          200: {
            description: "Current controller session",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ControllerSession" },
              },
            },
          },
          401: {
            description: "Controller session required or expired",
          },
        },
      },
    },
  },
};

function createTaggedPaths(document, tagName, basePath) {
  return Object.fromEntries(
    Object.entries(document.paths).map(([path, operations]) => {
      const fullPath = `${basePath}${path === "/" ? "" : path}`;
      return [
        fullPath,
        Object.fromEntries(
          Object.entries(operations).map(([method, operation]) => [
            method,
            {
              ...operation,
              tags: operation.tags ?? [tagName],
            },
          ]),
        ),
      ];
    }),
  );
}

export const combinedOpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "tikpal-speaker Unified API",
    version: "1.0.0",
    description: "Unified OpenAPI document for all tikpal-speaker HTTP APIs.",
  },
  servers: [{ url: "/" }],
  tags: [
    {
      name: "System API",
      description: "Device, state, integrations, sessions, and OTA endpoints under /api/v1/system.",
    },
    {
      name: "Flow API",
      description: "Legacy Flow control endpoints under /api/v1/flow.",
    },
  ],
  components: {
    securitySchemes: structuredClone(systemOpenApiDocument.components.securitySchemes),
    schemas: {
      ...structuredClone(systemOpenApiDocument.components.schemas),
      ...structuredClone(flowOpenApiDocument.components.schemas),
    },
  },
  paths: {
    ...createTaggedPaths(systemOpenApiDocument, "System API", "/api/v1/system"),
    ...createTaggedPaths(flowOpenApiDocument, "Flow API", "/api/v1/flow"),
  },
};
