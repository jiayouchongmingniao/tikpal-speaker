const commonSchemas = {
  Mode: {
    type: "string",
    enum: ["overview", "listen", "flow", "screen"],
  },
  FocusPanel: {
    type: "string",
    enum: ["listen", "flow", "screen"],
  },
  ControlSource: {
    type: "string",
    enum: ["touch", "remote", "portable_controller", "api", "system", "speaker-ui", "remote-client"],
  },
  FlowState: {
    type: "string",
    enum: ["focus", "flow", "relax", "sleep"],
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
    },
    "/actions": {
      post: {
        summary: "Trigger a Flow control action",
        security: [{ tikpalApiKey: [] }],
        responses: {
          200: { description: "Updated snapshot after action" },
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
    },
  },
  paths: {
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
        responses: { 200: { description: "Capabilities snapshot" } },
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
  },
};
