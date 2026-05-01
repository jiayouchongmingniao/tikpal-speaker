import assert from "node:assert/strict";
import { createScreenContext } from "../server/screenContextService.js";
import { createSystemStateStore } from "../server/systemStateStore.js";
import { createPendingVisualAction, reconcilePendingVisualState } from "../src/viewmodels/pendingVisualSync.js";
import { getInitialModeFromLocation } from "../src/routing.js";
import { getCreativeCareViewModel, getFlowCareCopy } from "../src/viewmodels/creativeCare.js";
import { getFlowSceneById } from "../src/viewmodels/flowScenes.js";

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function createStore() {
  return createSystemStateStore();
}

function settleTransition(store) {
  const snapshot = store.getSnapshot();
  snapshot.transition.lockedUntil = 0;
  snapshot.transition.status = "idle";
  return snapshot;
}

test("route parsing uses the last mode-like path segment", () => {
  assert.equal(getInitialModeFromLocation({ pathname: "/flow/listen/", search: "" }), "listen");
  assert.equal(getInitialModeFromLocation({ pathname: "/overview/flow/screen/", search: "" }), "screen");
  assert.equal(getInitialModeFromLocation({ pathname: "/debug", search: "?mode=flow" }), "flow");
});

test("pending visual mode sync keeps stale polling snapshots from replacing optimistic UI", () => {
  const staleState = createStore().getSnapshot();
  const optimisticState = {
    ...staleState,
    activeMode: "screen",
    focusedPanel: "screen",
    transition: {
      status: "animating",
      from: "overview",
      to: "screen",
      startedAt: "2026-05-01T00:00:00.000Z",
      lockedUntil: 10000,
    },
  };
  const pending = createPendingVisualAction("set_mode", optimisticState, 1000);
  const staleResult = reconcilePendingVisualState(staleState, pending, optimisticState, 2000);

  assert.equal(staleResult.pendingActive, true);
  assert.equal(staleResult.state.activeMode, "screen");
  assert.equal(staleResult.state.focusedPanel, "screen");

  const confirmedResult = reconcilePendingVisualState(
    {
      ...staleState,
      activeMode: "screen",
      focusedPanel: "screen",
    },
    pending,
    optimisticState,
    2500,
  );
  assert.equal(confirmedResult.pending, null);
  assert.equal(confirmedResult.state.activeMode, "screen");
});

test("pending visual scene sync keeps stale polling snapshots from replacing optimistic artwork", () => {
  const staleState = createStore().getSnapshot();
  const scene = getFlowSceneById("sleep-eyes-closed");
  const optimisticState = {
    ...staleState,
    activeMode: "flow",
    focusedPanel: "flow",
    flow: {
      ...staleState.flow,
      state: "sleep",
      sceneId: scene.id,
      sceneIndex: scene.index,
    },
    playback: {
      ...staleState.playback,
      trackTitle: scene.audioLabel,
    },
  };
  const pending = createPendingVisualAction("set_flow_scene", optimisticState, 1000);
  const result = reconcilePendingVisualState(staleState, pending, optimisticState, 2000);

  assert.equal(result.pendingActive, true);
  assert.equal(result.state.activeMode, "flow");
  assert.equal(result.state.flow.state, "sleep");
  assert.equal(result.state.flow.sceneId, "sleep-eyes-closed");
  assert.equal(result.state.playback.trackTitle, scene.audioLabel);
});

test("focus_panel updates overview focus without leaving overview", () => {
  const store = createStore();
  const state = store.runAction("focus_panel", { panel: "screen" }, "remote");

  assert.equal(state.activeMode, "overview");
  assert.equal(state.focusedPanel, "screen");
  assert.equal(state.lastSource, "remote");
});

test("return_overview keeps last focused panel from focus mode", () => {
  const store = createStore();
  store.runAction("set_mode", { mode: "flow" }, "touch");
  settleTransition(store);
  const state = store.runAction("return_overview", {}, "touch");

  assert.equal(state.activeMode, "overview");
  assert.equal(state.focusedPanel, "flow");
});

test("next_mode and prev_mode traverse focus modes", () => {
  const store = createStore();
  store.runAction("set_mode", { mode: "listen" }, "remote");
  settleTransition(store);

  const nextState = store.runAction("next_mode", {}, "remote");
  assert.equal(nextState.activeMode, "flow");

  settleTransition(store);

  const prevState = store.runAction("prev_mode", {}, "remote");
  assert.equal(prevState.activeMode, "listen");
});

test("mode actions can retarget while a previous transition is still animating", () => {
  const store = createStore();
  const listenState = store.runAction("set_mode", { mode: "listen" }, "remote");
  const screenState = store.runAction("set_mode", { mode: "screen" }, "remote");

  assert.equal(listenState.transition.status, "animating");
  assert.equal(screenState.activeMode, "screen");
  assert.equal(screenState.transition.from, "listen");
  assert.equal(screenState.transition.to, "screen");
});

test("show_controls is idempotent and can be hidden again", () => {
  const store = createStore();
  const first = store.runAction("show_controls", { reason: "touch" }, "touch");
  const second = store.runAction("show_controls", { reason: "touch" }, "touch");
  const hidden = store.runAction("hide_controls", {}, "touch");

  assert.equal(first.overlay.visible, true);
  assert.deepEqual(second.overlay, first.overlay);
  assert.equal(hidden.overlay.visible, false);
});

test("screen_start_pomodoro binds timer to current task", () => {
  const store = createStore();
  const state = store.runAction("screen_start_pomodoro", { durationSec: 1800 }, "portable_controller");

  assert.equal(state.activeMode, "screen");
  assert.equal(state.screen.pomodoroState, "running");
  assert.equal(state.screen.pomodoroDurationSec, 1800);
  assert.equal(state.screen.pomodoroRemainingSec, 1800);
  assert.equal(state.screen.pomodoroFocusTask, state.screen.currentTask);
});

test("screen_complete_current_task advances task and increments completed pomodoros", () => {
  const store = createStore();
  const previous = store.getSnapshot();
  const state = store.runAction("screen_complete_current_task", {}, "touch");

  assert.equal(state.screen.currentTask, previous.screen.nextTask);
  assert.equal(state.screen.completedPomodoros, previous.screen.completedPomodoros + 1);
  assert.equal(state.screen.pomodoroState, "idle");
  assert.equal(state.screen.pomodoroFocusTask, state.screen.currentTask);
});

test("voice_capture_submit updates creativeCare and keeps action logs privacy safe", () => {
  const store = createStore();
  const transcript = "I feel scattered but I have a small product idea. I want to shape it gently.";
  const state = store.runAction(
    "voice_capture_submit",
    {
      transcript,
      moodLabel: "scattered",
      moodIntensity: 0.8,
    },
    "portable_controller",
  );
  const [logEntry] = store.getActionLogs(1);

  assert.equal(state.creativeCare.latestTranscript, transcript);
  assert.equal(state.creativeCare.moodLabel, "scattered");
  assert.equal(state.creativeCare.currentCareMode, "focus");
  assert.equal(state.creativeCare.suggestedFlowState, "focus");
  assert.equal(state.creativeCare.metadata.captureLength, transcript.length);
  assert.equal(logEntry.payloadSummary.captureLength, transcript.length);
  assert.equal(JSON.stringify(logEntry).includes(transcript), false);
});

test("voice mood and explicit care mode update Flow recommendation", () => {
  const store = createStore();
  const moodState = store.runAction("voice_mood_set", { moodLabel: "energized", moodIntensity: 0.7 }, "portable_controller");
  assert.equal(moodState.creativeCare.currentCareMode, "flow");
  assert.equal(moodState.creativeCare.suggestedFlowState, "flow");

  const sleepState = store.runAction("voice_care_mode_set", { careMode: "sleep" }, "portable_controller");
  assert.equal(sleepState.creativeCare.currentCareMode, "sleep");
  assert.equal(sleepState.creativeCare.suggestedFlowState, "sleep");
});

test("flow scenes cycle within the current mode and remember per-mode selection", () => {
  const store = createStore();
  const first = store.getSnapshot();
  const second = store.runAction("next_flow_scene", {}, "touch");

  assert.equal(second.activeMode, "flow");
  assert.equal(second.flow.state, "focus");
  assert.notEqual(second.flow.sceneId, first.flow.sceneId);
  assert.equal(second.flow.sceneIndex, 1);

  settleTransition(store);
  const deepFlow = store.runAction("set_flow_state", { state: "flow" }, "touch");
  assert.equal(deepFlow.flow.state, "flow");
  assert.equal(deepFlow.flow.sceneIndex, 0);

  settleTransition(store);
  store.runAction("next_flow_scene", {}, "touch");
  settleTransition(store);
  const backToFocus = store.runAction("set_flow_state", { state: "focus" }, "touch");
  assert.equal(backToFocus.flow.state, "focus");
  assert.equal(backToFocus.flow.sceneIndex, 1);
});

test("flow scene actions still apply while the flow transition is animating", () => {
  const store = createStore();
  const first = store.runAction("next_flow_scene", {}, "touch");
  const second = store.runAction("next_flow_scene", {}, "touch");

  assert.equal(first.transition.status, "animating");
  assert.equal(second.flow.sceneIndex, 2);
  assert.notEqual(second.flow.sceneId, first.flow.sceneId);
});

test("set_flow_scene accepts explicit scene ids and aligns the top-level Flow state", () => {
  const store = createStore();
  const state = store.runAction("set_flow_scene", { sceneId: "sleep-between-meetings" }, "portable_controller");
  const scene = getFlowSceneById("sleep-between-meetings");

  assert.equal(state.flow.state, "sleep");
  assert.equal(state.flow.sceneId, "sleep-between-meetings");
  assert.equal(state.playback.trackTitle, scene?.audioLabel);
});

test("creative care view models fall back safely without voice context", () => {
  const viewModel = getCreativeCareViewModel({});

  assert.equal(viewModel.moodLabel, "clear");
  assert.equal(viewModel.currentCareMode, "flow");
  assert.equal(viewModel.flowLabel, "Deep Flow");
  assert.equal(viewModel.hasVoiceContext, false);
  assert.equal(getFlowCareCopy("relax").label, "Unwind");
});

test("invalid mode is rejected", () => {
  const store = createStore();
  assert.throws(
    () => store.runAction("set_mode", { mode: "invalid-mode" }, "api"),
    (error) => error.code === "INVALID_MODE",
  );
});

test("unknown actions are rejected", () => {
  const store = createStore();
  assert.throws(
    () => store.runAction("unknown_action", {}, "api"),
    (error) => error.code === "UNKNOWN_ACTION",
  );
});

test("screen context prefers manual focus over todoist and calendar", () => {
  const context = createScreenContext({
    screen: {
      currentTask: "Manual focus item",
      pomodoroFocusTask: "Pomodoro binding",
      pomodoroState: "running",
      pomodoroRemainingSec: 1200,
      pomodoroDurationSec: 1500,
      todaySummary: {
        remainingTasks: 9,
        remainingEvents: 7,
      },
      sync: {
        stale: false,
      },
    },
    integrations: {
      calendar: {
        status: "ok",
        currentEvent: {
          id: "cal_1",
          title: "Calendar block",
        },
      },
      todoist: {
        status: "ok",
        currentTask: {
          id: "todo_1",
          title: "Todoist task",
        },
      },
    },
  });

  assert.equal(context.focusItem.title, "Manual focus item");
  assert.equal(context.focusItem.source, "manual");
});

test("screen context prefers calendar block and next event over manual fallbacks", () => {
  const context = createScreenContext({
    screen: {
      currentBlockTitle: "Manual block",
      nextTask: "Manual next task",
      pomodoroState: "idle",
      pomodoroRemainingSec: 1500,
      pomodoroDurationSec: 1500,
      todaySummary: {
        remainingTasks: 4,
        remainingEvents: 3,
      },
      sync: {
        stale: false,
      },
    },
    integrations: {
      calendar: {
        status: "ok",
        currentEvent: {
          id: "cal_current",
          title: "Deep Work Block",
          startsAt: "2026-04-21T09:00:00Z",
          endsAt: "2026-04-21T10:00:00Z",
        },
        nextEvent: {
          id: "cal_next",
          title: "Review notes",
          startsAt: "2026-04-21T10:30:00Z",
        },
        remainingEvents: 2,
      },
      todoist: {
        status: "ok",
        remainingTasks: 5,
      },
    },
  });

  assert.equal(context.currentBlock.title, "Deep Work Block");
  assert.equal(context.currentBlock.source, "calendar");
  assert.equal(context.nextBlock.title, "Review notes");
  assert.equal(context.nextBlock.source, "calendar");
  assert.equal(context.todaySummary.remainingEvents, 2);
});

test("screen context falls back to todoist next task when no calendar next event exists", () => {
  const context = createScreenContext({
    screen: {
      pomodoroState: "paused",
      pomodoroRemainingSec: 600,
      pomodoroDurationSec: 1500,
      todaySummary: {
        remainingTasks: 1,
        remainingEvents: 0,
      },
      sync: {
        stale: false,
      },
    },
    integrations: {
      calendar: {
        status: "idle",
        currentEvent: null,
        nextEvent: null,
        remainingEvents: 0,
      },
      todoist: {
        status: "stale",
        currentTask: {
          id: "todo_current",
          title: "Write Spec",
        },
        nextTask: {
          id: "todo_next",
          title: "Refine roadmap",
        },
        remainingTasks: 6,
      },
    },
  });

  assert.equal(context.focusItem.title, "Write Spec");
  assert.equal(context.focusItem.source, "todoist");
  assert.equal(context.nextBlock.title, "Refine roadmap");
  assert.equal(context.nextBlock.source, "todoist");
  assert.equal(context.todaySummary.remainingTasks, 6);
  assert.equal(context.sync.stale, true);
});

console.log("Smoke tests passed.");
