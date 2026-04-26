import { useEffect, useMemo, useState } from "react";
import { createSystemServiceClient } from "../bridge/systemServiceClient";

const DEFAULT_PORTABLE_CAPABILITIES = ["mode_switch", "playback", "flow_control", "screen_control", "creative_care"];
const SESSION_ID_STORAGE_KEY = "tikpal-portable-session-id";

function deriveScreenContext(nextState) {
  const screen = nextState?.screen ?? {};
  return {
    now: new Date().toISOString(),
    focusItem:
      screen.pomodoroFocusTask || screen.currentTask
        ? {
            id: screen.pomodoroFocusTask ? "manual_pomodoro_focus" : "manual_focus",
            title: screen.pomodoroFocusTask ?? screen.currentTask,
            source: "manual",
          }
        : null,
    currentBlock: screen.currentBlockTitle
      ? {
          id: "manual_current_block",
          title: screen.currentBlockTitle,
          source: "manual",
        }
      : null,
    nextBlock: screen.nextTask
      ? {
          id: "manual_next_item",
          title: screen.nextTask,
          source: "manual",
          kind: "task",
        }
      : null,
    pomodoro: {
      state: screen.pomodoroState ?? "idle",
      remainingSec: Number(screen.pomodoroRemainingSec ?? screen.pomodoroDurationSec ?? 1500),
      durationSec: Number(screen.pomodoroDurationSec ?? 1500),
      boundTaskId: screen.pomodoroFocusTask ? "manual_pomodoro_focus" : screen.currentTask ? "manual_focus" : null,
    },
    todaySummary: {
      remainingTasks: Number(screen.todaySummary?.remainingTasks ?? 55),
      remainingEvents: Number(screen.todaySummary?.remainingEvents ?? 0),
    },
    sync: {
      stale: Boolean(screen.sync?.stale),
      lastCalendarSyncAt: null,
      lastTodoistSyncAt: null,
      calendarStatus: "idle",
      todoistStatus: "idle",
    },
  };
}

function clearStoredSession() {
  window.localStorage.removeItem(SESSION_ID_STORAGE_KEY);
}

export function usePortableController() {
  const client = useMemo(() => createSystemServiceClient(), []);
  const [state, setState] = useState(null);
  const [screenContext, setScreenContext] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [session, setSession] = useState(null);
  const [apiKey, setApiKeyState] = useState(client.apiKey);
  const [pairingCode, setPairingCodeState] = useState("");
  const [generatedPairing, setGeneratedPairing] = useState(null);
  const [status, setStatus] = useState(client.sessionToken ? "connected" : "read-only");
  const [error, setError] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState(null);

  useEffect(() => {
    if (!generatedPairing?.expiresAt) {
      return undefined;
    }

    const expiresAtMs = new Date(generatedPairing.expiresAt).getTime();
    if (Number.isNaN(expiresAtMs)) {
      return undefined;
    }

    const timeoutMs = Math.max(0, expiresAtMs - Date.now());
    const timeoutId = window.setTimeout(() => {
      setGeneratedPairing((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          expired: true,
        };
      });
    }, timeoutMs + 50);

    return () => window.clearTimeout(timeoutId);
  }, [generatedPairing?.expiresAt]);

  function handleSessionFailure(nextError) {
    const code = nextError?.payload?.error?.code ?? "";
    const nextStatus = nextError?.status === 401 || code === "SESSION_INVALID" ? "expired" : "offline";

    if (nextStatus === "expired") {
      client.setSessionToken("");
      clearStoredSession();
      setSession(null);
    }

    setStatus(nextStatus);
    setError(nextError.message);
  }

  useEffect(() => {
    let alive = true;

    async function sync() {
      try {
        const bootstrap = await client.getPortableBootstrap();
        if (!alive) {
          return;
        }

        setState(bootstrap.state);
        setScreenContext(bootstrap.screenContext ?? deriveScreenContext(bootstrap.state));
        setCapabilities(bootstrap.capabilities);
        setSession(bootstrap.session);
        setStatus(bootstrap.session ? "connected" : "read-only");
        setError("");
        setLastSyncAt(Date.now());
      } catch (nextError) {
        if (!alive) {
          return;
        }

        handleSessionFailure(nextError);
      }
    }

    sync();
    const intervalId = window.setInterval(sync, 1000);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [client]);

  async function connectPortable(nextApiKey) {
    const normalizedApiKey = nextApiKey.trim();
    setError("");
    setStatus("connecting");
    client.setApiKey(normalizedApiKey);
    setApiKeyState(normalizedApiKey);

    try {
      const nextSession = await client.createControllerSession({
        capabilities: DEFAULT_PORTABLE_CAPABILITIES,
      });
      setSession(nextSession);
      setStatus("connected");
      setLastSyncAt(Date.now());
      return nextSession;
    } catch (nextError) {
      setStatus("error");
      setError(nextError.message);
      throw nextError;
    }
  }

  async function claimPortablePairingCode(nextCode) {
    const normalizedCode = nextCode.trim();
    setError("");
    setStatus("connecting");

    try {
      const nextSession = await client.claimPairingCode({
        code: normalizedCode,
        capabilities: DEFAULT_PORTABLE_CAPABILITIES,
      });
      setSession(nextSession);
      setStatus("connected");
      setLastSyncAt(Date.now());
      setPairingCodeState("");
      return nextSession;
    } catch (nextError) {
      setStatus("error");
      setError(nextError.message);
      throw nextError;
    }
  }

  async function generatePortablePairingCode(nextApiKey) {
    const normalizedApiKey = nextApiKey.trim();
    setError("");
    setStatus("connecting");
    client.setApiKey(normalizedApiKey);
    setApiKeyState(normalizedApiKey);

    try {
      const nextPairing = await client.createPairingCode({
        role: "controller",
        capabilities: DEFAULT_PORTABLE_CAPABILITIES,
      });
      setGeneratedPairing({
        ...nextPairing,
        expired: false,
      });
      setStatus(session ? "connected" : "read-only");
      return nextPairing;
    } catch (nextError) {
      setStatus("error");
      setError(nextError.message);
      throw nextError;
    }
  }

  async function restoreSession(sessionId) {
    if (!sessionId) {
      return null;
    }

    try {
      const nextSession = await client.getCurrentControllerSession();
      setSession(nextSession);
      setStatus("connected");
      setLastSyncAt(Date.now());
      return nextSession;
    } catch (nextError) {
      setSession(null);
      handleSessionFailure(nextError);
      return null;
    }
  }

  useEffect(() => {
    if (!client.sessionToken || session?.id) {
      return;
    }

    restoreSession(window.localStorage.getItem(SESSION_ID_STORAGE_KEY) || "");
  }, [client, session?.id]);

  async function sendAction(type, payload = {}) {
    try {
      const response = await client.sendAction(type, payload, "portable_controller");
      if (response?.state) {
        setState(response.state);
        setScreenContext(deriveScreenContext(response.state));
      }
      setStatus("connected");
      setError("");
      setLastSyncAt(Date.now());
      return response;
    } catch (nextError) {
      handleSessionFailure(nextError);
      throw nextError;
    }
  }

  return {
    apiKey,
    pairingCode,
    generatedPairing,
    state,
    screenContext,
    capabilities,
    session,
    status,
    error,
    lastSyncAt,
    isConnected: status === "connected",
    hasWriteAccess: status === "connected",
    setApiKey(value) {
      setApiKeyState(value);
    },
    setPairingCode(value) {
      setPairingCodeState(value);
    },
    clearGeneratedPairing() {
      setGeneratedPairing(null);
    },
    async connect() {
      const nextSession = await connectPortable(apiKey);
      if (nextSession?.id) {
        window.localStorage.setItem(SESSION_ID_STORAGE_KEY, nextSession.id);
      }
      return nextSession;
    },
    async generatePairingCode() {
      if (!apiKey) {
        setStatus("error");
        setError("Admin API key required to generate pairing code");
        return null;
      }

      return generatePortablePairingCode(apiKey);
    },
    async claimCode() {
      const nextSession = await claimPortablePairingCode(pairingCode);
      if (nextSession?.id) {
        window.localStorage.setItem(SESSION_ID_STORAGE_KEY, nextSession.id);
      }
      return nextSession;
    },
    async reconnect() {
      if (!apiKey) {
        setStatus("error");
        setError("Admin API key required to reconnect");
        return null;
      }

      return connectPortable(apiKey);
    },
    async refresh() {
      const bootstrap = await client.getPortableBootstrap();
      setState(bootstrap.state);
      setCapabilities(bootstrap.capabilities);
      setSession(bootstrap.session);
      setStatus(bootstrap.session ? "connected" : "read-only");
      setError("");
      setLastSyncAt(Date.now());
      return bootstrap;
    },
    async disconnect() {
      if (session?.id) {
        try {
          await client.revokeControllerSession(session.id);
        } catch {
          // Keep local cleanup even if the server-side revoke fails.
        }
      } else {
        client.clearPortableAuth();
      }
      clearStoredSession();
      setSession(null);
      setStatus("read-only");
      setError("");
    },
    sendAction,
  };
}
