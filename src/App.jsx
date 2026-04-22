import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ConnectorDebugPage } from "./components/ConnectorDebugPage";
import { PortableControllerPage } from "./components/PortableControllerPage";
import { SystemShell } from "./components/SystemShell";

export function App() {
  const params = new URLSearchParams(window.location.search);
  const initialState = params.get("state") ?? "focus";
  const initialMode = params.get("mode") ?? "overview";
  const surface = params.get("surface") ?? "";
  const pathname = window.location.pathname.toLowerCase();
  const debug = import.meta.env.DEV;
  const isPortableSurface = surface === "portable" || pathname.includes("/portable");
  const isDebugSurface = surface === "debug" || pathname.includes("/debug");

  return (
    <AppErrorBoundary debug={debug}>
      {isDebugSurface ? (
        <ConnectorDebugPage />
      ) : isPortableSurface ? (
        <PortableControllerPage />
      ) : (
        <SystemShell initialFlowState={initialState} initialMode={initialMode} debug={debug} />
      )}
    </AppErrorBoundary>
  );
}
