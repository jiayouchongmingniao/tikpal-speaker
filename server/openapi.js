const commonSchemas = {
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
            type: "string",
            enum: ["overview", "listen", "flow", "screen"],
          },
          focusedPanel: {
            type: ["string", "null"],
            enum: ["listen", "flow", "screen", null],
          },
          overlay: { type: "object" },
          playback: { type: "object" },
          flow: { type: "object" },
          screen: { type: "object" },
          system: { type: "object" },
          lastSource: { type: "string" },
          lastUpdatedAt: { type: "string", format: "date-time" },
        },
      },
      ActionRequest: {
        type: "object",
        required: ["type"],
        properties: {
          type: { type: "string" },
          payload: { type: "object" },
          source: { type: "string" },
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
            },
          },
        },
        responses: {
          200: { description: "Updated system state" },
        },
      },
    },
  },
};
