import assert from "node:assert/strict";
import { createSystemStateStore } from "../server/systemStateStore.js";

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

console.log("Smoke tests passed.");
