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

## Smoke Test

Run the Batch C system-state smoke checks:

```bash
npm run test:smoke
```

Run HTTP-level smoke checks for `/api/v1/system/actions`:

```bash
npm run test:http-smoke
```

## Run As Services

The repo includes `systemd` templates for the API (`8787`) and web preview (`4173`).

Default deployment layout:

- app dir: `/home/moode/code/tikpal-speaker`
- service user: `moode`

Install on the target machine:

```bash
cd /home/moode/code/tikpal-speaker
npm install
npm run build
sudo APP_DIR=/home/moode/code/tikpal-speaker SERVICE_USER=moode bash deploy/systemd/install-systemd-services.sh
```

Service names:

- `tikpal-api.service`
- `tikpal-web.service`

Useful commands:

```bash
sudo systemctl restart tikpal-api tikpal-web
sudo systemctl status tikpal-api tikpal-web
journalctl -u tikpal-api -u tikpal-web -f
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

## System API And Batch E Debugging

Run the system API locally:

```bash
npm run dev:api
```

Key endpoints:

- `GET /api/v1/system/state`
- `GET /api/v1/system/capabilities`
- `GET /api/v1/system/screen/context`
- `PATCH /api/v1/system/integrations/calendar`
- `PATCH /api/v1/system/integrations/todoist`
- `GET /api/v1/system/integrations/calendar/fixtures`
- `GET /api/v1/system/integrations/todoist/fixtures`
- `POST /api/v1/system/integrations/calendar/sync`
- `POST /api/v1/system/integrations/todoist/sync`
- `GET /api/v1/system/integrations/{connector}/sync-jobs/{jobId}`

Open the Batch E debug surface in the browser:

- `http://localhost:4173/flow/?surface=debug`
- `http://localhost:4173/flow/debug`

The debug surface lets you:

- inspect the active System API base URL and health status
- see whether the current Admin API key is accepted
- inspect live `ScreenContext`
- inspect `SystemState.integrations`
- inspect `SystemState.creativeCare`
- submit a manual Creative Care voice-capture sample
- list connector fixtures
- trigger mock sync jobs with `success`, `stale`, or `error`
- verify how `ScreenContext` reacts to `calendar` and `todoist` changes
- verify Creative Care runtime summaries and privacy-safe action logs

For local admin actions, start the API with a key and enter the same value in the debug surface:

```bash
TIKPAL_API_KEY=dev-admin-key npm run dev:api
```

The key can also be passed as `?apiKey=dev-admin-key` for local debugging.

Minimal manual verification flow:

```bash
curl -s http://localhost:8787/api/v1/system/integrations/calendar/fixtures
curl -s -X POST http://localhost:8787/api/v1/system/integrations/calendar/sync \
  -H 'Content-Type: application/json' \
  -H 'X-Tikpal-Key: dev-admin-key' \
  -d '{"scenario":"success","fixture":"meeting_heavy","delayMs":50}'
curl -s http://localhost:8787/api/v1/system/screen/context
curl -s -X POST http://localhost:8787/api/v1/system/actions \
  -H 'Content-Type: application/json' \
  -H 'X-Tikpal-Key: dev-admin-key' \
  -d '{"type":"voice_capture_submit","payload":{"transcript":"I feel scattered but one idea is ready.","moodLabel":"scattered","moodIntensity":0.7},"source":"debug_surface"}'
```

Current Batch E scope:

- `ScreenContext service` exists and is consumed by `ScreenPage`
- connector mock sync lifecycle covers `syncing -> ok/stale/error`
- fixture-based sample scenarios are available for `calendar` and `todoist`
- Creative Care debug sampling is available for portable voice-capture flows
- HTTP smoke tests cover action responses, connector sync, stale/error behavior, and fixture application

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
