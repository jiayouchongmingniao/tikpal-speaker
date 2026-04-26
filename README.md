# tikpal-speaker

Ambient OS prototype for a 32:9 speaker display UI.

## Current scope

- React + Vite frontend
- Unified `Overview / Listen / Flow / Screen` shell
- System API with action dispatch, capabilities, controller sessions, pairing codes, runtime logs, ScreenContext, OTA status, and mock connector sync
- Portable controller surface for mode, playback, Flow, Screen, and Creative Care voice-capture control
- Creative Care state from user-submitted voice capture only; no biometric or hidden sensor claims
- Local JSON persistence for SystemState, controller sessions, pairing codes, and safe connector credential metadata

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

Run the core system-state smoke checks:

```bash
npm run test:smoke
```

Run ScreenContext consumer checks:

```bash
npm run test:screen-context
```

Run connector adapter contract checks:

```bash
npm run test:connectors
```

Run player bridge contract checks:

```bash
npm run test:player
npm run test:player-server
```

Run HTTP-level smoke checks for `/api/v1/system/actions`:

```bash
npm run test:http-smoke
```

Run performance budget and telemetry summary checks:

```bash
npm run test:performance
```

Summarize a Raspberry Pi performance trace exported from `/api/v1/system/runtime/performance-samples`:

```bash
npm run performance:trace -- ./performance-samples.json
```

Run restart/persistence recovery checks:

```bash
npm run test:persistence
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

By default the API persists runtime state to `.tikpal/system-state.json` and connector secrets to
`.tikpal/connector-secrets.json`. Override them with `TIKPAL_STATE_FILE=/path/to/system-state.json`
and `TIKPAL_SECRET_FILE=/path/to/connector-secrets.json`, or disable state persistence with
`TIKPAL_DISABLE_PERSISTENCE=1`.

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
- `GET /api/v1/system/runtime/performance-samples`

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
- inspect current performance tier, suggested tier, sampler metrics, and Flow Canvas render budget
- inspect recent performance samples for FPS, latency, memory, active mode, tier, and reason
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
- connector adapter contract exists; the default fixture adapters preserve local `calendar` and `todoist` mock sync
- real Calendar/Todoist adapter skeletons map provider payloads into the same ScreenContext-safe connector patch shape
- sync lifecycle covers `syncing -> ok/stale/error`, including adapter failures that preserve last-good connector snapshots
- fixture-based sample scenarios are available for `calendar` and `todoist`
- Creative Care debug sampling is available for portable voice-capture flows
- local persistence keeps restart recovery testable without changing the public API response shape
- frontend performance sampling reports FPS/latency/memory into `runtime_report_performance`
- Flow Canvas consumes `normal / reduced / safe` budgets for pixel ratio, wave density, particle count, and frame skipping
- HTTP smoke tests cover action responses, connector sync, stale/error behavior, and fixture application

Real connector adapter notes:

- `server/connectorAdapters.js` is the integration boundary for Calendar/Todoist providers.
- Fixture adapters are the default so local development and tests do not require external accounts.
- Real adapters accept runtime credentials or a future service-owned secret store. Persisted connector metadata intentionally excludes raw access and refresh tokens.
- Connector `connect` stores raw provider tokens in the local secret store, while `SystemState` and runtime logs only expose safe metadata and `credentialRef`. It can accept service-owned tokens directly or exchange an `authorizationCode` / `code` through the configured provider token endpoint.
- Expired provider tokens are refreshed during real sync when a refresh token and token endpoint are configured. Refreshed access tokens are written back to the local secret store, not to public `SystemState`.
- Sync jobs accept `maxAttempts` and `retryDelayMs` for transient provider failures, and job reads expose `attempts`, `adapterMode`, `lastErrorCode`, and `nextRetryAt`.
- Enable real sync with `TIKPAL_CONNECTOR_MODE=real`, or per provider with `TIKPAL_CALENDAR_CONNECTOR_MODE=real` / `TIKPAL_TODOIST_CONNECTOR_MODE=real`.
- Calendar config can use `TIKPAL_CALENDAR_API_BASE`, `TIKPAL_CALENDAR_TIMEOUT_MS`, `TIKPAL_CALENDAR_ID`, `TIKPAL_CALENDAR_TOKEN_URL`, `TIKPAL_CALENDAR_CLIENT_ID`, and `TIKPAL_CALENDAR_CLIENT_SECRET`.
- Todoist config can use `TIKPAL_TODOIST_API_BASE`, `TIKPAL_TODOIST_TIMEOUT_MS`, `TIKPAL_TODOIST_TOKEN_URL`, `TIKPAL_TODOIST_CLIENT_ID`, and `TIKPAL_TODOIST_CLIENT_SECRET`.

## Architecture

```text
src/
  bridge/
  components/
  hooks/
  theme.js
```

## Next step

Move from mock-backed integrations to real device integrations:

1. Wire real Calendar/Todoist credentials into `server/connectorAdapters.js` through a service-owned secret store or runtime injection while keeping fixtures for tests.
2. Point the browser bridge at a moOde-compatible HTTP control surface with `?playerApiBase=...` or `window.__TIKPAL_PLAYER_API_BASE__`; point the System API at the same device with `TIKPAL_PLAYER_API_BASE=...` so portable playback actions update real device state while preserving the existing `playback` shape.
3. Validate the frontend performance sampler on Raspberry Pi 4 and tune `normal / reduced / safe` thresholds with real FPS traces using `npm run performance:trace`.
4. Turn OTA apply/rollback from the current state-machine skeleton into release-directory, restart, health-check, and rollback behavior.
