import { useEffect, useState } from "react";
import { usePortableController } from "../hooks/usePortableController";
import { CREATIVE_CARE_MOODS, CREATIVE_CARE_MODES, getCreativeCareViewModel, getFlowCareCopy } from "../viewmodels/creativeCare";
import { getFlowScenesForState } from "../viewmodels/flowScenes";
import { getPortableScreenCardViewModel } from "../viewmodels/screenContextConsumers";

const FLOW_STATES = ["focus", "flow", "relax", "sleep"];
const MODES = ["overview", "listen", "flow", "screen"];
const MODE_LABELS = {
  overview: "Overview",
  listen: "Listen",
  flow: "Flow",
  screen: "Screen",
};

function statusLabel(status) {
  if (status === "connected") {
    return "controller connected";
  }

  if (status === "expired") {
    return "session expired";
  }

  if (status === "offline") {
    return "offline";
  }

  if (status === "connecting") {
    return "connecting";
  }

  if (status === "error") {
    return "connect failed";
  }

  return "read only";
}

function formatCountdown(expiresAt) {
  const remainingSec = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getPortableSurfaceSummary(activeMode, state, currentFlowScene, screenCard) {
  if (activeMode === "listen") {
    return {
      title: state?.playback?.trackTitle ?? "No track",
      detail: state?.playback?.artist ?? "Playback ready",
    };
  }

  if (activeMode === "flow") {
    return {
      title: getFlowCareCopy(state?.flow?.state ?? "focus").label,
      detail: `${currentFlowScene.label} · Scene ${currentFlowScene.index + 1}/5`,
    };
  }

  if (activeMode === "screen") {
    return {
      title: screenCard.title,
      detail: screenCard.timerLabel,
    };
  }

  return {
    title: MODE_LABELS[state?.focusedPanel] ?? "Overview",
    detail: "Mode hub and quick handoff",
  };
}

function getPortableStatusHint(status, session, state, screenCard) {
  if (status === "connected" && session?.expiresAt) {
    return `Linked until ${new Date(session.expiresAt).toLocaleString()}`;
  }

  if (status === "expired") {
    return "Session expired. Re-pair or reconnect to resume control.";
  }

  if (status === "offline" || status === "error") {
    return "Controller cannot reach speaker right now.";
  }

  if (state?.activeMode === "screen") {
    return `${screenCard.title} · ${screenCard.timerLabel}`;
  }

  return "Portable can switch modes and Flow scenes through the system API.";
}

function PortablePairingView({
  controller,
  status,
  error,
  apiKey,
  pairingCode,
  generatedPairing,
  lastSyncAt,
  onEnterController,
}) {
  const [, setPairingNow] = useState(Date.now());
  const pairingRemaining = generatedPairing?.expiresAt ? formatCountdown(generatedPairing.expiresAt) : "00:00";

  useEffect(() => {
    if (!generatedPairing?.expiresAt || generatedPairing.expired) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setPairingNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [generatedPairing?.expiresAt, generatedPairing?.expired]);

  async function copyPairingCode() {
    if (!generatedPairing?.code || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(generatedPairing.code);
  }

  return (
    <section className="portable-pairing-view">
      <div className="portable-pairing-shell">
        <header className="portable-pairing-hero">
          <span className="portable-kicker">Portable Pairing</span>
          <h1>6-digit onboarding</h1>
          <p>Pair first, control later. This screen is dedicated to session setup and recovery.</p>
          <div className={`portable-status portable-status--${status}`}>
            <strong>{statusLabel(status)}</strong>
            <span>{generatedPairing?.code ? "Pairing active" : "Waiting for setup"}</span>
          </div>
        </header>

        <section className="portable-pairing-layout">
          <article className="portable-pairing-panel">
            <span className="portable-card__label">Admin Side</span>
            <h2>Generate code</h2>
            <p>Use admin key to mint a short-lived 6-digit code. The portable device claims it once and gets a controller session.</p>
            <div className="portable-connect-row">
              <input
                type="password"
                value={apiKey}
                onChange={(event) => controller.setApiKey(event.target.value)}
                placeholder="Admin API key"
              />
              <button
                type="button"
                className="portable-button"
                onClick={() => controller.generatePairingCode()}
                disabled={!apiKey || status === "connecting"}
              >
                Generate code
              </button>
            </div>
            {generatedPairing ? (
              <div className={`portable-pairing-card portable-pairing-card--hero ${generatedPairing.expired ? "is-expired" : ""}`.trim()}>
                <span>Pairing code</span>
                <strong>{generatedPairing.code}</strong>
                <p>
                  {generatedPairing.expired ? "Expired" : `Valid for ${pairingRemaining}`} · expires{" "}
                  {new Date(generatedPairing.expiresAt).toLocaleString()}
                </p>
                <div className="portable-pairing-actions">
                  <button type="button" className="portable-button portable-button--ghost" onClick={() => copyPairingCode()} disabled={generatedPairing.expired}>
                    Copy code
                  </button>
                  <button type="button" className="portable-button portable-button--ghost" onClick={() => controller.clearGeneratedPairing()}>
                    Clear
                  </button>
                </div>
              </div>
            ) : null}
          </article>

          <article className="portable-pairing-panel">
            <span className="portable-card__label">Portable Side</span>
            <h2>Claim code</h2>
            <p>Enter the 6-digit code here. Once claimed, the device gets a controller session and moves into the main control surface.</p>
            <div className="portable-connect-row">
              <input
                type="text"
                value={pairingCode}
                onChange={(event) => controller.setPairingCode(event.target.value)}
                placeholder="6-digit pairing code"
                inputMode="numeric"
              />
              <button type="button" className="portable-button" onClick={() => controller.claimCode()} disabled={!pairingCode || status === "connecting"}>
                Claim code
              </button>
              <button type="button" className="portable-button portable-button--ghost" onClick={() => controller.connect()} disabled={status === "connecting"}>
                Connect with key
              </button>
            </div>
            {error ? <p className="portable-error">{error}</p> : null}
            <div className="portable-pairing-hints">
              <p>Code format: 6 digits</p>
              <p>Single use: a claimed code cannot be reused</p>
              <p>Fallback: admin key can still mint a direct session when needed</p>
            </div>
            {lastSyncAt ? <p className="portable-session-meta">Last sync {new Date(lastSyncAt).toLocaleString()}</p> : null}
          </article>
        </section>

        <footer className="portable-pairing-footer">
          <button type="button" className="portable-button portable-button--ghost" onClick={() => controller.refresh()}>
            Refresh
          </button>
          <button type="button" className="portable-button portable-button--ghost" onClick={() => controller.disconnect()}>
            Clear session
          </button>
          <button type="button" className="portable-button" onClick={onEnterController}>
            Open controller
          </button>
        </footer>
      </div>
    </section>
  );
}

function PortableControlView({ controller, state, screenContext, capabilities, session, status, error, hasWriteAccess, lastSyncAt, onOpenPairing }) {
  const activeMode = state?.activeMode ?? "overview";
  const playbackState = state?.playback?.state ?? "pause";
  const playbackVolume = state?.playback?.volume ?? 58;
  const flowState = state?.flow?.state ?? "focus";
  const flowScenes = getFlowScenesForState(flowState);
  const currentFlowScene = flowScenes.find((scene) => scene.id === state?.flow?.sceneId) ?? flowScenes[0];
  const creativeCare = getCreativeCareViewModel(state);
  const screenCard = getPortableScreenCardViewModel(state, screenContext);
  const pomodoroState = screenCard.pomodoroState;
  const surfaceSummary = getPortableSurfaceSummary(activeMode, state, currentFlowScene, screenCard);
  const statusHint = getPortableStatusHint(status, session, state, screenCard);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceMood, setVoiceMood] = useState(creativeCare.moodLabel);
  const [voiceIntensity, setVoiceIntensity] = useState(creativeCare.moodIntensity);
  const [voiceCareMode, setVoiceCareMode] = useState(creativeCare.currentCareMode);
  const [listening, setListening] = useState(false);
  const SpeechRecognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const canUseSpeechRecognition = Boolean(SpeechRecognition);

  useEffect(() => {
    setVoiceMood(creativeCare.moodLabel);
    setVoiceIntensity(creativeCare.moodIntensity);
    setVoiceCareMode(creativeCare.currentCareMode);
  }, [creativeCare.moodLabel, creativeCare.moodIntensity, creativeCare.currentCareMode]);

  function startSpeechRecognition() {
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) {
        setVoiceTranscript((current) => [current, transcript].filter(Boolean).join(" ").trim());
      }
    };
    recognition.start();
  }

  async function submitVoiceCapture() {
    await controller.sendAction("voice_capture_submit", {
      transcript: voiceTranscript,
      moodLabel: voiceMood,
      moodIntensity: voiceIntensity,
      careMode: voiceCareMode,
      source: "portable_controller",
    });
    setVoiceTranscript("");
  }

  return (
    <section className="portable-control-view">
      <section className="portable-shell">
        <header className="portable-header">
          <div>
            <span className="portable-kicker">Portable</span>
            <h1>System controller</h1>
            <p>Mode, playback, Flow and Screen rhythm without mirroring the main display.</p>
          </div>
          <div className={`portable-status portable-status--${status}`}>
            <strong>{statusLabel(status)}</strong>
            <span>{session?.name ?? (status === "expired" ? "Session token cleared" : "No controller session")}</span>
          </div>
        </header>

        <section className="portable-connect-card">
          <div>
            <strong>Session</strong>
            <p>Controller surface is now separate from onboarding. Pairing and recovery live in a dedicated full-screen view.</p>
          </div>
          <div className="portable-connect-row">
            <button type="button" className="portable-button" onClick={onOpenPairing}>
              Open pairing
            </button>
            <button type="button" className="portable-button portable-button--ghost" onClick={() => controller.refresh()}>
              Refresh
            </button>
            <button
              type="button"
              className="portable-button portable-button--ghost"
              onClick={() => controller.reconnect()}
              disabled={status === "connecting"}
            >
              Reconnect
            </button>
            <button type="button" className="portable-button portable-button--ghost" onClick={() => controller.disconnect()}>
              Disconnect
            </button>
          </div>
          {error ? <p className="portable-error">{error}</p> : null}
          {session ? (
            <p className="portable-session-meta">
              {session.role} · expires {new Date(session.expiresAt).toLocaleString()} · last seen {session.lastSeenAt ?? "not yet"}
            </p>
          ) : status === "expired" ? (
            <p className="portable-session-meta">Session expired. Reconnect or return to pairing to recover write access.</p>
          ) : null}
          {lastSyncAt ? <p className="portable-session-meta">Last sync {new Date(lastSyncAt).toLocaleString()}</p> : null}
        </section>

        <section className="portable-dashboard">
          <article className="portable-card portable-card--dashboard">
            <span className="portable-card__label">Mode</span>
            <div className="portable-card__headline">
              <h2>{MODE_LABELS[activeMode] ?? "Overview"}</h2>
              <p>{surfaceSummary.detail}</p>
            </div>
            <div className="portable-chip-grid portable-chip-grid--modes">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`portable-chip ${activeMode === mode ? "is-active" : ""}`}
                  disabled={!hasWriteAccess}
                  onClick={() => controller.sendAction(mode === "overview" ? "return_overview" : "set_mode", mode === "overview" ? {} : { mode })}
                >
                  {MODE_LABELS[mode]}
                </button>
              ))}
            </div>
            <div className="portable-stat-grid">
              <div>
                <span>Current mode</span>
                <strong>{activeMode}</strong>
              </div>
              <div>
                <span>Last source</span>
                <strong>{state?.lastSource ?? "unknown"}</strong>
              </div>
            </div>
          </article>

          <article className="portable-card portable-card--dashboard">
            <span className="portable-card__label">Volume</span>
            <div className="portable-card__headline">
              <h2>{playbackState === "play" ? "Playing" : "Paused"}</h2>
              <p>{state?.playback?.trackTitle ?? "No active track"}</p>
            </div>
            <div className="portable-control-row">
              <button type="button" className="portable-button portable-button--ghost" disabled={!hasWriteAccess} onClick={() => controller.sendAction("prev_track")}>
                Prev
              </button>
              <button type="button" className="portable-button" disabled={!hasWriteAccess} onClick={() => controller.sendAction("toggle_play")}>
                {playbackState === "play" ? "Pause" : "Play"}
              </button>
              <button type="button" className="portable-button portable-button--ghost" disabled={!hasWriteAccess} onClick={() => controller.sendAction("next_track")}>
                Next
              </button>
            </div>
            <label className="portable-slider">
              <span>Volume {playbackVolume}%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={playbackVolume}
                disabled={!hasWriteAccess}
                onChange={(event) => controller.sendAction("set_volume", { volume: Number(event.target.value) })}
              />
            </label>
          </article>

          <article className="portable-card portable-card--dashboard">
            <span className="portable-card__label">Flow</span>
            <div className="portable-card__headline">
              <h2>{getFlowCareCopy(flowState).label}</h2>
              <p>{currentFlowScene.label} · {currentFlowScene.subtitle}</p>
            </div>
            <div className="portable-chip-grid portable-chip-grid--states">
              {FLOW_STATES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`portable-chip ${flowState === item ? "is-active" : ""}`}
                  disabled={!hasWriteAccess}
                  onClick={() => controller.sendAction("set_flow_state", { state: item })}
                >
                  {getFlowCareCopy(item).label}
                </button>
              ))}
            </div>
            <div className="portable-card__subhead">
              <strong>{state?.flow?.sceneIndex != null ? `Scene ${Number(state.flow.sceneIndex) + 1}/5` : "Scene 1/5"}</strong>
              <button
                type="button"
                className="portable-button portable-button--ghost"
                disabled={!hasWriteAccess}
                onClick={() => controller.sendAction("next_flow_scene")}
              >
                Next scene
              </button>
            </div>
            <div className="portable-chip-grid portable-chip-grid--scenes">
              {flowScenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  className={`portable-chip ${state?.flow?.sceneId === scene.id ? "is-active" : ""}`}
                  disabled={!hasWriteAccess}
                  onClick={() => controller.sendAction("set_flow_scene", { sceneId: scene.id, sceneIndex: scene.index })}
                >
                  {scene.index + 1}
                </button>
              ))}
            </div>
          </article>

          <article className="portable-card portable-card--dashboard">
            <span className="portable-card__label">Status</span>
            <div className="portable-card__headline">
              <h2>{surfaceSummary.title}</h2>
              <p>{statusHint}</p>
            </div>
            <div className="portable-stat-grid">
              <div>
                <span>Session</span>
                <strong>{statusLabel(status)}</strong>
              </div>
              <div>
                <span>Performance</span>
                <strong>{state?.system?.performanceTier ?? capabilities?.performance?.tier ?? "normal"}</strong>
              </div>
              <div>
                <span>Controllers</span>
                <strong>{state?.controller?.activeSessionCount ?? 0}</strong>
              </div>
              <div>
                <span>Focus timer</span>
                <strong>{screenCard.timerLabel}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="portable-grid portable-grid--secondary">
          <article className="portable-card portable-card--voice">
            <span className="portable-card__label">Voice Capture</span>
            <h2>{creativeCare.moodText} · {creativeCare.careText}</h2>
            <p>{creativeCare.insightSentence}</p>
            <textarea
              className="portable-voice-input"
              value={voiceTranscript}
              onChange={(event) => setVoiceTranscript(event.target.value)}
              placeholder="Say or type what is on your mind."
              rows={4}
              disabled={!hasWriteAccess}
            />
            <div className="portable-mode-row" aria-label="Mood">
              {CREATIVE_CARE_MOODS.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  className={`portable-chip ${voiceMood === mood ? "is-active" : ""}`}
                  disabled={!hasWriteAccess}
                  onClick={() => {
                    setVoiceMood(mood);
                    controller.sendAction("voice_mood_set", { moodLabel: mood, moodIntensity: voiceIntensity }).catch(() => {});
                  }}
                >
                  {mood}
                </button>
              ))}
            </div>
            <label className="portable-slider">
              <span>Intensity {Math.round(voiceIntensity * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={voiceIntensity}
                disabled={!hasWriteAccess}
                onChange={(event) => setVoiceIntensity(Number(event.target.value))}
              />
            </label>
            <div className="portable-mode-row" aria-label="Care mode">
              {CREATIVE_CARE_MODES.map((careMode) => (
                <button
                  key={careMode}
                  type="button"
                  className={`portable-chip ${voiceCareMode === careMode ? "is-active" : ""}`}
                  disabled={!hasWriteAccess}
                  onClick={() => {
                    setVoiceCareMode(careMode);
                    controller.sendAction("voice_care_mode_set", { careMode }).catch(() => {});
                  }}
                >
                  {careMode}
                </button>
              ))}
            </div>
            <div className="portable-control-row">
              <button type="button" className="portable-button portable-button--ghost" disabled={!hasWriteAccess || !canUseSpeechRecognition || listening} onClick={startSpeechRecognition}>
                {listening ? "Listening" : "Use microphone"}
              </button>
              <button type="button" className="portable-button" disabled={!hasWriteAccess} onClick={submitVoiceCapture}>
                Submit
              </button>
              <button type="button" className="portable-button portable-button--ghost" disabled={!hasWriteAccess} onClick={() => controller.sendAction("voice_reflection_clear")}>
                Clear
              </button>
            </div>
          </article>

          <article className="portable-card">
            <span className="portable-card__label">Screen</span>
            <h2>{screenCard.title}</h2>
            <p>{screenCard.timerLabel}</p>
            <div className="portable-control-row">
              <button
                type="button"
                className="portable-button"
                disabled={!hasWriteAccess}
                onClick={() => controller.sendAction(pomodoroState === "paused" ? "screen_resume_pomodoro" : "screen_start_pomodoro", { durationSec: 1500 })}
              >
                {pomodoroState === "paused" ? "Resume" : "Start"}
              </button>
              <button type="button" className="portable-button portable-button--ghost" disabled={!hasWriteAccess} onClick={() => controller.sendAction("screen_pause_pomodoro")}>
                Pause
              </button>
              <button type="button" className="portable-button portable-button--ghost" disabled={!hasWriteAccess} onClick={() => controller.sendAction("screen_reset_pomodoro")}>
                Reset
              </button>
              <button type="button" className="portable-button portable-button--ghost" disabled={!hasWriteAccess} onClick={() => controller.sendAction("screen_complete_current_task")}>
                Done
              </button>
            </div>
            <div className="portable-stat-grid">
              <div>
                <span>Next task</span>
                <strong>{screenCard.nextTitle}</strong>
              </div>
              <div>
                <span>Done today</span>
                <strong>{state?.screen?.completedPomodoros ?? 0}</strong>
              </div>
            </div>
          </article>
        </section>
      </section>
    </section>
  );
}

export function PortableControllerPage() {
  const controller = usePortableController();
  const { state, screenContext, capabilities, session, status, error, apiKey, pairingCode, generatedPairing, hasWriteAccess, lastSyncAt } = controller;
  const [view, setView] = useState(session ? "controller" : "pairing");

  useEffect(() => {
    if (session && view !== "controller") {
      setView("controller");
      return;
    }

    if (!session && view === "controller") {
      setView("pairing");
    }
  }, [session, view]);

  return (
    <main className="portable-page">
      {view === "pairing" ? (
        <PortablePairingView
          controller={controller}
          status={status}
          error={error}
          apiKey={apiKey}
          pairingCode={pairingCode}
          generatedPairing={generatedPairing}
          lastSyncAt={lastSyncAt}
          onEnterController={() => setView("controller")}
        />
      ) : (
        <PortableControlView
          controller={controller}
          state={state}
          screenContext={screenContext}
          capabilities={capabilities}
          session={session}
          status={status}
          error={error}
          hasWriteAccess={hasWriteAccess}
          lastSyncAt={lastSyncAt}
          onOpenPairing={() => setView("pairing")}
        />
      )}
    </main>
  );
}
