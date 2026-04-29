import { useEffect, useState } from "react";
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

  useEffect(() => {
    function preventDefaultGesture(event) {
      event.preventDefault();
    }

    function preventBrowserZoomOnWheel(event) {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    }

    function preventMultiTouchBrowserPanZoom(event) {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    }

    document.addEventListener("gesturestart", preventDefaultGesture, { passive: false });
    document.addEventListener("gesturechange", preventDefaultGesture, { passive: false });
    document.addEventListener("gestureend", preventDefaultGesture, { passive: false });
    document.addEventListener("wheel", preventBrowserZoomOnWheel, { passive: false });
    document.addEventListener("mousewheel", preventBrowserZoomOnWheel, { passive: false });
    document.addEventListener("touchmove", preventMultiTouchBrowserPanZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventDefaultGesture);
      document.removeEventListener("gesturechange", preventDefaultGesture);
      document.removeEventListener("gestureend", preventDefaultGesture);
      document.removeEventListener("wheel", preventBrowserZoomOnWheel);
      document.removeEventListener("mousewheel", preventBrowserZoomOnWheel);
      document.removeEventListener("touchmove", preventMultiTouchBrowserPanZoom);
    };
  }, []);

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
