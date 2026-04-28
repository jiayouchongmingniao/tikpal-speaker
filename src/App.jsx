import { useState } from "react";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ConnectorDebugPage } from "./components/ConnectorDebugPage";
import { PortableControllerPage } from "./components/PortableControllerPage";
import { SystemShell } from "./components/SystemShell";
import { getInitialModeFromLocation, getSurfaceFromLocation } from "./routing";
import { persistAndApplyFontPreset, readStoredFontPreset } from "./typography";

function ensureDevelopmentApiKey() {
  if (!import.meta.env.DEV) {
    return;
  }

  try {
    if (!window.localStorage.getItem("tikpal-portable-api-key")) {
      window.localStorage.setItem("tikpal-portable-api-key", "dev-admin-key");
    }
  } catch {
    // Ignore storage failures in dev bootstrap.
  }
}

export function App() {
  ensureDevelopmentApiKey();
  const params = new URLSearchParams(window.location.search);
  const initialState = params.get("state") ?? "focus";
  const initialMode = getInitialModeFromLocation(window.location);
  const surface = getSurfaceFromLocation(window.location);
  const debug = import.meta.env.DEV;
  const [fontPresetId, setFontPresetId] = useState(() => readStoredFontPreset());

  function handleFontPresetChange(nextPresetId) {
    setFontPresetId(persistAndApplyFontPreset(nextPresetId));
  }

  return (
    <AppErrorBoundary debug={debug}>
      {surface === "debug" ? (
        <ConnectorDebugPage />
      ) : surface === "portable" ? (
        <PortableControllerPage />
      ) : (
        <SystemShell
          initialFlowState={initialState}
          initialMode={initialMode}
          debug={debug}
          fontPresetId={fontPresetId}
          onFontPresetChange={handleFontPresetChange}
        />
      )}
    </AppErrorBoundary>
  );
}
