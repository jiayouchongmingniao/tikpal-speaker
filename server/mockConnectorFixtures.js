export const MOCK_CONNECTOR_FIXTURES = {
  calendar: {
    default: {
      accountLabel: "calendar.mock@tikpal.local",
      currentEvent: {
        id: "cal_mock_current",
        title: "Deep Work Block",
        startsAt: "2026-04-22T09:00:00Z",
        endsAt: "2026-04-22T10:00:00Z",
      },
      nextEvent: {
        id: "cal_mock_next",
        title: "Review notes",
        startsAt: "2026-04-22T10:30:00Z",
      },
      remainingEvents: 2,
    },
    meeting_heavy: {
      accountLabel: "calendar.meetings@tikpal.local",
      currentEvent: {
        id: "cal_meeting_current",
        title: "Standup",
        startsAt: "2026-04-22T09:30:00Z",
        endsAt: "2026-04-22T10:00:00Z",
      },
      nextEvent: {
        id: "cal_meeting_next",
        title: "Product Review",
        startsAt: "2026-04-22T10:15:00Z",
      },
      remainingEvents: 5,
    },
    afternoon_focus: {
      accountLabel: "calendar.focus@tikpal.local",
      currentEvent: {
        id: "cal_focus_current",
        title: "Focus Block",
        startsAt: "2026-04-22T13:00:00Z",
        endsAt: "2026-04-22T15:00:00Z",
      },
      nextEvent: {
        id: "cal_focus_next",
        title: "1:1 Review",
        startsAt: "2026-04-22T15:30:00Z",
      },
      remainingEvents: 1,
    },
  },
  todoist: {
    default: {
      accountLabel: "todoist.mock@tikpal.local",
      currentTask: {
        id: "todo_mock_current",
        title: "Write Spec",
        priority: 4,
      },
      nextTask: {
        id: "todo_mock_next",
        title: "Refine roadmap",
      },
      remainingTasks: 6,
    },
    writing_day: {
      accountLabel: "todoist.writer@tikpal.local",
      currentTask: {
        id: "todo_writing_current",
        title: "Draft chapter outline",
        priority: 3,
      },
      nextTask: {
        id: "todo_writing_next",
        title: "Edit intro section",
      },
      remainingTasks: 4,
    },
    triage_day: {
      accountLabel: "todoist.triage@tikpal.local",
      currentTask: {
        id: "todo_triage_current",
        title: "Inbox zero",
        priority: 2,
      },
      nextTask: {
        id: "todo_triage_next",
        title: "Respond to blockers",
      },
      remainingTasks: 11,
    },
  },
};

export function listConnectorFixtures(name) {
  return Object.keys(MOCK_CONNECTOR_FIXTURES[name] ?? {});
}

export function getConnectorFixture(name, fixture = "default") {
  return MOCK_CONNECTOR_FIXTURES[name]?.[fixture] ?? null;
}
