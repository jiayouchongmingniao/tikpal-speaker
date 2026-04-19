export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "tikpal-speaker Flow Control API",
    version: "1.0.0",
    description: "REST API for controlling the Flow Mode screen from touch input, local automation, or tikpal.ai portable controllers.",
  },
  servers: [
    { url: "/api/v1/flow" },
  ],
  components: {
    securitySchemes: {
      tikpalApiKey: {
        type: "apiKey",
        in: "header",
        name: "X-Tikpal-Key",
      },
    },
    schemas: {
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
      FlowSnapshot: {
        type: "object",
        properties: {
          currentState: { $ref: "#/components/schemas/FlowState" },
          uiVisible: { type: "boolean" },
          appPhase: {
            type: "string",
            enum: ["booting", "idle_preview", "immersive", "controls_visible", "transitioning", "sleep_dimmed"],
          },
          playerState: { $ref: "#/components/schemas/PlayerState" },
          audioMetrics: {
            type: "object",
            properties: {
              volumeNormalized: { type: "number" },
              lowEnergy: { type: "number" },
              midEnergy: { type: "number" },
              highEnergy: { type: "number" },
              beatConfidence: { type: "number" },
              isPlaying: { type: "boolean" },
            },
          },
          updatedAt: { type: "string", format: "date-time" },
          lastSource: { type: "string" },
        },
      },
      FlowAction: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            type: "string",
            enum: [
              "toggle_play",
              "set_volume",
              "show_controls",
              "hide_controls",
              "next_state",
              "set_state",
              "set_track",
            ],
          },
          payload: { type: "object" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          200: {
            description: "Service is up",
          },
        },
      },
    },
    "/state": {
      get: {
        summary: "Read the latest Flow Mode snapshot",
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
        summary: "Patch the Flow Mode snapshot",
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
                  source: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated snapshot",
          },
        },
      },
    },
    "/actions": {
      post: {
        summary: "Trigger a high-level control action",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/FlowAction" },
            },
          },
        },
        responses: {
          200: {
            description: "Updated snapshot after action",
          },
        },
      },
    },
    "/controller-sessions": {
      post: {
        summary: "Register a portable controller session",
        security: [{ tikpalApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  deviceId: { type: "string" },
                  name: { type: "string" },
                  capabilities: {
                    type: "array",
                    items: { type: "string" },
                  },
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
  },
};
