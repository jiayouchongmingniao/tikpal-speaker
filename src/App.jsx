import { FlowModePage } from "./components/FlowModePage";

export function App() {
  const params = new URLSearchParams(window.location.search);
  const initialState = params.get("state") ?? "focus";

  return <FlowModePage initialState={initialState} />;
}
