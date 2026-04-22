function nowIso() {
  return new Date().toISOString();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeConnectorStatus(status) {
  const allowed = new Set(["idle", "syncing", "ok", "stale", "error", "revoked", "unconfigured"]);
  return allowed.has(status) ? status : "idle";
}

function deriveFocusItem(screen, integrations) {
  if (isNonEmptyString(screen.currentTask)) {
    return {
      id: "manual_focus",
      title: screen.currentTask,
      source: "manual",
    };
  }

  if (isNonEmptyString(screen.pomodoroFocusTask)) {
    return {
      id: "manual_pomodoro_focus",
      title: screen.pomodoroFocusTask,
      source: "manual",
    };
  }

  if (isNonEmptyString(integrations.todoist?.currentTask?.title)) {
    return {
      id: integrations.todoist.currentTask.id ?? "todoist_focus",
      title: integrations.todoist.currentTask.title,
      source: "todoist",
      priority: integrations.todoist.currentTask.priority ?? undefined,
      dueAt: integrations.todoist.currentTask.dueAt ?? undefined,
    };
  }

  if (isNonEmptyString(integrations.calendar?.currentEvent?.title)) {
    return {
      id: integrations.calendar.currentEvent.id ?? "calendar_focus",
      title: integrations.calendar.currentEvent.title,
      source: "calendar",
    };
  }

  return null;
}

function deriveCurrentBlock(screen, integrations) {
  if (isNonEmptyString(integrations.calendar?.currentEvent?.title)) {
    return {
      id: integrations.calendar.currentEvent.id ?? "calendar_current_block",
      title: integrations.calendar.currentEvent.title,
      startsAt: integrations.calendar.currentEvent.startsAt ?? undefined,
      endsAt: integrations.calendar.currentEvent.endsAt ?? undefined,
      source: "calendar",
    };
  }

  if (isNonEmptyString(screen.currentBlockTitle)) {
    return {
      id: "manual_current_block",
      title: screen.currentBlockTitle,
      source: "manual",
    };
  }

  return null;
}

function deriveNextBlock(screen, integrations) {
  if (isNonEmptyString(integrations.calendar?.nextEvent?.title)) {
    return {
      id: integrations.calendar.nextEvent.id ?? "calendar_next_event",
      title: integrations.calendar.nextEvent.title,
      startsAt: integrations.calendar.nextEvent.startsAt ?? undefined,
      source: "calendar",
      kind: "event",
    };
  }

  if (isNonEmptyString(integrations.todoist?.nextTask?.title)) {
    return {
      id: integrations.todoist.nextTask.id ?? "todoist_next_task",
      title: integrations.todoist.nextTask.title,
      startsAt: integrations.todoist.nextTask.startsAt ?? undefined,
      source: "todoist",
      kind: "task",
    };
  }

  if (isNonEmptyString(screen.nextTask)) {
    return {
      id: "manual_next_item",
      title: screen.nextTask,
      source: "manual",
      kind: "task",
    };
  }

  return null;
}

export function createScreenContext(systemState) {
  const state = systemState ?? {};
  const screen = state.screen ?? {};
  const integrations = state.integrations ?? {};
  const calendar = integrations.calendar ?? {};
  const todoist = integrations.todoist ?? {};
  const focusItem = deriveFocusItem(screen, integrations);

  return {
    now: nowIso(),
    focusItem,
    currentBlock: deriveCurrentBlock(screen, integrations),
    nextBlock: deriveNextBlock(screen, integrations),
    pomodoro: {
      state: screen.pomodoroState ?? "idle",
      remainingSec: Number(screen.pomodoroRemainingSec ?? screen.pomodoroDurationSec ?? 1500),
      durationSec: Number(screen.pomodoroDurationSec ?? 1500),
      boundTaskId: focusItem?.id ?? undefined,
    },
    todaySummary: {
      remainingTasks: Number(todoist.remainingTasks ?? screen.todaySummary?.remainingTasks ?? 0),
      remainingEvents: Number(calendar.remainingEvents ?? screen.todaySummary?.remainingEvents ?? 0),
    },
    sync: {
      stale: Boolean(screen.sync?.stale || calendar.status === "stale" || todoist.status === "stale"),
      lastCalendarSyncAt: calendar.lastSyncAt ?? null,
      lastTodoistSyncAt: todoist.lastSyncAt ?? null,
      calendarStatus: normalizeConnectorStatus(calendar.status ?? "idle"),
      todoistStatus: normalizeConnectorStatus(todoist.status ?? "idle"),
    },
  };
}
