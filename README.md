# tikpal-speaker

Flow Mode prototype for a 32:9 speaker display UI.

## Current scope

- React + Vite frontend
- 4 Flow Mode states: `focus`, `flow`, `relax`, `sleep`
- Full-screen ambient background and canvas-based main visual
- Minimal state title, side info panel, and transient control overlay
- Player bridge abstraction with mock data ready to swap for moOde integration

## Run locally

```bash
npm install
npm run dev
```

Main view: [http://localhost:4173/](http://localhost:4173/)

Preview gallery: [http://localhost:4173/preview.html](http://localhost:4173/preview.html)

## Build

```bash
npm run build
```

## Flow Control API

The repo now includes a lightweight REST service for touchscreens and external controllers such as `https://tikpal.ai`.

Run it locally:

```bash
npm run dev:api
```

Default endpoint:

- `http://localhost:8787/api/v1/flow/health`
- `http://localhost:8787/api/v1/flow/state`
- `http://localhost:8787/api/v1/flow/openapi.json`

Recommended reverse proxy shape on the speaker device:

- UI: `/flow/`
- API: `/api/v1/flow/*`

Suggested control flow for `tikpal.ai`:

1. `POST /api/v1/flow/controller-sessions`
2. `GET /api/v1/flow/state`
3. `POST /api/v1/flow/actions`
4. `PATCH /api/v1/flow/state` for speaker-originated snapshot sync

Mutation endpoints support `X-Tikpal-Key` or `Authorization: Bearer <key>` when `TIKPAL_API_KEY` is configured.

## Architecture

```text
src/
  bridge/
  components/
  hooks/
  theme.js
```

## Next step

Replace `src/bridge/playerBridge.js` with a moOde-backed implementation that preserves the same subscription and control API.
