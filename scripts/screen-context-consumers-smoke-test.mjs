import assert from "node:assert/strict";
import {
  getOverviewScreenCardViewModel,
  getOverlayScreenViewModel,
  getOverlayStatusHint,
  getPortableScreenCardViewModel,
  getScreenPageViewModel,
} from "../src/viewmodels/screenContextConsumers.js";

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function createState(overrides = {}) {
  return {
    screen: {
      currentTask: "Raw focus",
      nextTask: "Raw next",
      currentBlockTitle: "Raw block",
      pomodoroState: "running",
      pomodoroFocusTask: "Raw pomodoro focus",
      pomodoroDurationSec: 1500,
      pomodoroRemainingSec: 1124,
      completedPomodoros: 2,
      todaySummary: {
        remainingTasks: 3,
        remainingEvents: 2,
      },
      sync: {
        status: "mock",
        stale: false,
      },
    },
    controller: {
      activeSessionCount: 0,
    },
    system: {
      otaStatus: "idle",
      performanceTier: "normal",
    },
    ...overrides,
  };
}

function createScreenContext(overrides = {}) {
  return {
    focusItem: {
      id: "focus_1",
      title: "Context focus",
      source: "todoist",
    },
    currentBlock: {
      id: "block_1",
      title: "Context block",
      source: "calendar",
    },
    nextBlock: {
      id: "next_1",
      title: "Context next",
      source: "calendar",
      kind: "event",
    },
    pomodoro: {
      state: "paused",
      remainingSec: 600,
      durationSec: 1500,
      boundTaskId: "focus_1",
    },
    todaySummary: {
      remainingTasks: 7,
      remainingEvents: 4,
    },
    sync: {
      stale: true,
      calendarStatus: "stale",
      todoistStatus: "ok",
    },
    ...overrides,
  };
}

test("screen page view model prefers ScreenContext over raw screen state", () => {
  const viewModel = getScreenPageViewModel(createState(), createScreenContext());

  assert.equal(viewModel.focusTitle, "Context focus");
  assert.equal(viewModel.currentBlockTitle, "Context block");
  assert.equal(viewModel.nextTitle, "Context next");
  assert.equal(viewModel.remaining, 600);
  assert.equal(viewModel.remainingTasks, 7);
  assert.equal(viewModel.remainingEvents, 4);
  assert.equal(viewModel.syncStatus, "stale");
  assert.equal(viewModel.isPaused, true);
});

test("screen page view model falls back to raw state when ScreenContext is missing", () => {
  const viewModel = getScreenPageViewModel(createState(), null);

  assert.equal(viewModel.focusTitle, "Raw focus");
  assert.equal(viewModel.currentBlockTitle, "Raw block");
  assert.equal(viewModel.nextTitle, "Raw next");
  assert.equal(viewModel.remaining, 1124);
  assert.equal(viewModel.syncStatus, "mock");
  assert.equal(viewModel.isRunning, true);
});

test("overview screen card view model formats ScreenContext-derived summary", () => {
  const viewModel = getOverviewScreenCardViewModel(createState(), createScreenContext());

  assert.equal(viewModel.title, "Context focus");
  assert.equal(viewModel.subtitle, "10:00 left");
  assert.equal(viewModel.meta, "7 tasks left today");
  assert.equal(viewModel.detail, "Next Context next");
});

test("portable screen card view model uses ScreenContext timer and next item", () => {
  const viewModel = getPortableScreenCardViewModel(createState(), createScreenContext());

  assert.equal(viewModel.title, "Context focus");
  assert.equal(viewModel.timerLabel, "10:00 · paused");
  assert.equal(viewModel.nextTitle, "Context next");
  assert.equal(viewModel.pomodoroState, "paused");
});

test("overlay screen view model and status hint honor stale context", () => {
  const state = createState({
    controller: { activeSessionCount: 0 },
    system: { otaStatus: "idle", performanceTier: "normal" },
  });
  const screenContext = createScreenContext();
  const screenView = getOverlayScreenViewModel(state, screenContext);
  const statusHint = getOverlayStatusHint(state, screenContext);

  assert.equal(screenView.hint, "Context focus · 10:00 left");
  assert.equal(screenView.isPaused, true);
  assert.equal(statusHint, "Screen sync stale");
});

test("overlay status hint prefers controller and ota statuses over stale", () => {
  const otaState = createState({
    system: { otaStatus: "applying", performanceTier: "normal" },
  });
  assert.equal(getOverlayStatusHint(otaState, createScreenContext()), "Applying update");

  const controllerState = createState({
    controller: { activeSessionCount: 2 },
    system: { otaStatus: "idle", performanceTier: "normal" },
  });
  assert.equal(getOverlayStatusHint(controllerState, createScreenContext()), "2 controller connected");
});

console.log("ScreenContext consumer smoke tests passed.");
