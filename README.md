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

## Build

```bash
npm run build
```

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
