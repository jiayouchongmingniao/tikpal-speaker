import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { SystemShell } from "./components/SystemShell";

export function App() {
  const params = new URLSearchParams(window.location.search);
  const initialState = params.get("state") ?? "focus";
  const initialMode = params.get("mode") ?? "overview";
  const debug = import.meta.env.DEV;

  return (
    <AppErrorBoundary debug={debug}>
      <SystemShell initialFlowState={initialState} initialMode={initialMode} debug={debug} />
    </AppErrorBoundary>
  );
}
