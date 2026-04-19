import { useEffect } from "react";
import { FlowModePage } from "./FlowModePage";
import { ListenPage } from "./ListenPage";
import { OverviewPage } from "./OverviewPage";
import { ScreenPage } from "./ScreenPage";
import { useSystemController } from "../hooks/useSystemController";

function ShellChrome({ activeMode, onModeChange, onReturnOverview, onTogglePlay }) {
  return (
    <div className="shell-chrome">
      <button className="shell-button shell-button--ghost" onClick={onReturnOverview} type="button">
        Overview
      </button>
      <div className="shell-mode-switcher" role="tablist" aria-label="System modes">
        {["listen", "flow", "screen"].map((mode) => (
          <button
            key={mode}
            className={`shell-mode-chip ${activeMode === mode ? "is-active" : ""}`}
            onClick={() => onModeChange(mode)}
            type="button"
          >
            {mode}
          </button>
        ))}
      </div>
      <button className="shell-button" onClick={onTogglePlay} type="button">
        Play
      </button>
    </div>
  );
}

export function SystemShell({ initialMode = "overview", initialFlowState = "focus" }) {
  const controller = useSystemController({ initialMode, initialFlowState });
  const { state } = controller;

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" || event.key === "Backspace") {
        controller.returnOverview();
        return;
      }

      if (event.key === "1") {
        controller.setMode("listen");
        return;
      }

      if (event.key === "2") {
        controller.setMode("flow");
        return;
      }

      if (event.key === "3") {
        controller.setMode("screen");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller]);

  return (
    <div className={`system-shell mode-${state.activeMode}`}>
      {state.activeMode === "overview" ? (
        <OverviewPage
          state={state}
          onOpenMode={controller.setMode}
          onTogglePlay={controller.togglePlay}
          onSetFlowState={controller.setFlowState}
          onPausePomodoro={controller.pausePomodoro}
        />
      ) : null}

      {state.activeMode === "listen" ? (
        <ListenPage
          state={state}
          onTogglePlay={controller.togglePlay}
          onSetVolume={controller.setVolume}
        />
      ) : null}

      {state.activeMode === "flow" ? <FlowModePage initialState={state.flow.state} /> : null}

      {state.activeMode === "screen" ? (
        <ScreenPage
          state={state}
          onStartPomodoro={controller.startPomodoro}
          onPausePomodoro={controller.pausePomodoro}
          onCompleteTask={controller.completeCurrentTask}
        />
      ) : null}

      <ShellChrome
        activeMode={state.activeMode}
        onModeChange={controller.setMode}
        onReturnOverview={controller.returnOverview}
        onTogglePlay={controller.togglePlay}
      />
    </div>
  );
}
