import { useEffect } from "react";
import { AmbientBackground } from "./AmbientBackground";
import { ControlOverlay } from "./ControlOverlay";
import { SideInfoPanel } from "./SideInfoPanel";
import { StateTitle } from "./StateTitle";
import { VisualEngineCanvas } from "./VisualEngineCanvas";
import { useFlowModeController } from "../hooks/useFlowModeController";
import { FLOW_ORDER, FLOW_THEME } from "../theme";

export function FlowModePage({ initialState = "focus" }) {
  const controller = useFlowModeController(initialState);
  const theme = FLOW_THEME[controller.currentState];

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "ArrowLeft") {
        controller.nextState("left");
        return;
      }

      if (event.key === "ArrowRight") {
        controller.nextState("right");
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        controller.showControls();
        return;
      }

      if (event.key === "Enter") {
        controller.showControls();
        return;
      }

      if (event.key === "Backspace" || event.key === "Escape") {
        controller.hideControls();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller]);

  function onPointerDown() {
    controller.showControls();
  }

  function onTouchStart(startEvent) {
    const startX = startEvent.touches[0]?.clientX ?? 0;

    function onTouchEnd(endEvent) {
      const endX = endEvent.changedTouches[0]?.clientX ?? startX;
      const deltaX = endX - startX;
      if (Math.abs(deltaX) > 64) {
        controller.nextState(deltaX > 0 ? "right" : "left");
      } else {
        controller.showControls();
      }

      window.removeEventListener("touchend", onTouchEnd);
    }

    window.addEventListener("touchend", onTouchEnd, { once: true });
  }

  return (
    <main
      className={`flow-page phase-${controller.appPhase} tone-${theme.uiTone}`}
      onPointerDown={onPointerDown}
      onTouchStart={onTouchStart}
      role="application"
      aria-label="Flow mode"
    >
      <AmbientBackground
        currentState={controller.currentState}
        transitionState={controller.transitionState}
      />
      <VisualEngineCanvas
        currentState={controller.currentState}
        theme={theme}
        audioMetrics={controller.audioMetrics}
        appPhase={controller.appPhase}
      />
      <section className="flow-page__content">
        <StateTitle
          title={theme.label}
          subtitle={theme.subtitle}
          appPhase={controller.appPhase}
        />
        <SideInfoPanel
          playerState={controller.playerState}
          volume={controller.playerState.volume}
          visible={controller.uiVisible || controller.appPhase === "idle_preview"}
        />
      </section>
      <ControlOverlay
        visible={controller.uiVisible}
        currentState={controller.currentState}
        stateOrder={FLOW_ORDER}
        playbackState={controller.playerState.playbackState}
        volume={controller.playerState.volume}
        onTogglePlay={controller.togglePlay}
        onVolumeChange={controller.setVolume}
        onStateSelect={controller.setState}
      />
    </main>
  );
}
