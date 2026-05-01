import { useEffect, useState } from "react";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ConnectorDebugPage } from "./components/ConnectorDebugPage";
import { PortableControllerPage } from "./components/PortableControllerPage";
import { SystemShell } from "./components/SystemShell";
import { useAppInteractionGuard } from "./hooks/useAppInteractionGuard";
import { getSurfaceFromLocation } from "./routing";
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

const STARTUP_SPLASH_MS = 2200;

function StartupSplash() {
  return (
    <main className="startup-splash" aria-label="Tikpal Speaker startup">
      <div className="startup-splash__content">
        <span className="startup-splash__eyebrow">Booting ambient shell</span>
        <h1>Tikpal Speaker</h1>
        <p>A three-mode ambient operation system: Listen, Flow, and Screen.</p>
      </div>
    </main>
  );
}

export function App() {
  ensureDevelopmentApiKey();
  const params = new URLSearchParams(window.location.search);
  const initialState = params.get("state") ?? "focus";
  const surface = getSurfaceFromLocation(window.location);
  const debug = import.meta.env.DEV;
  const [fontPresetId, setFontPresetId] = useState(() => readStoredFontPreset());
  const [startupComplete, setStartupComplete] = useState(surface !== "main");
  useAppInteractionGuard({ debug });

  useEffect(() => {
    if (surface !== "main") {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setStartupComplete(true);
    }, STARTUP_SPLASH_MS);

    return () => window.clearTimeout(timerId);
  }, [surface]);

  function handleFontPresetChange(nextPresetId) {
    setFontPresetId(persistAndApplyFontPreset(nextPresetId));
  }

  return (
    <AppErrorBoundary debug={debug}>
      {surface === "debug" ? (
        <ConnectorDebugPage />
      ) : surface === "portable" ? (
        <PortableControllerPage />
      ) : !startupComplete ? (
        <StartupSplash />
      ) : (
        <SystemShell
          initialFlowState={initialState}
          initialMode="overview"
          debug={debug}
          fontPresetId={fontPresetId}
          onFontPresetChange={handleFontPresetChange}
        />
      )}
    </AppErrorBoundary>
  );
}
