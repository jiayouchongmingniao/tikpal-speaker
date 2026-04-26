import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ConnectorDebugPage } from "./components/ConnectorDebugPage";
import { PortableControllerPage } from "./components/PortableControllerPage";
import { SystemShell } from "./components/SystemShell";
import { getInitialModeFromLocation, getSurfaceFromLocation } from "./routing";

export function App() {
  const params = new URLSearchParams(window.location.search);
  const initialState = params.get("state") ?? "focus";
  const initialMode = getInitialModeFromLocation(window.location);
  const surface = getSurfaceFromLocation(window.location);
  const debug = import.meta.env.DEV;

  return (
    <AppErrorBoundary debug={debug}>
      {surface === "debug" ? (
        <ConnectorDebugPage />
      ) : surface === "portable" ? (
        <PortableControllerPage />
      ) : (
        <SystemShell initialFlowState={initialState} initialMode={initialMode} debug={debug} />
      )}
    </AppErrorBoundary>
  );
}
