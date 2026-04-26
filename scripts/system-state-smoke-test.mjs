import assert from "node:assert/strict";
import { createScreenContext } from "../server/screenContextService.js";
import { createSystemStateStore } from "../server/systemStateStore.js";
import { getCreativeCareViewModel, getFlowCareCopy } from "../src/viewmodels/creativeCare.js";

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
