import { useEffect, useMemo, useState } from "react";
import { createSystemServiceClient } from "../bridge/systemServiceClient";
import { getPerformanceDebugViewModel } from "../viewmodels/performance";

const CONNECTORS = ["calendar", "todoist"];
const SCENARIOS = ["success", "stale", "error"];
const CREATIVE_MOODS = ["clear", "scattered", "stuck", "tired", "calm", "energized"];
const CREATIVE_CARE_MODES = ["focus", "flow", "unwind", "sleep"];
const FALLBACK_FIXTURES = {
  calendar: ["default", "meeting_heavy", "afternoon_focus"],
  todoist: ["default", "writing_day", "triage_day"],
};

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function getDebugEntryUrl() {
  return `${window.location.origin}/flow/?surface=debug`;
}

function getDebugPathUrl() {
  return `${window.location.origin}/flow/debug`;
}

function getAdminKeySource() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("apiKey")) {
    return "URL query";
  }

  if (window.localStorage.getItem("tikpal-portable-api-key")) {
    return "local storage";
  }

  return "manual entry";
}

function ConnectorControlCard({ connector, control, onChange, onRunSync, integrationState, latestJob }) {
  const fixtures = control.fixtures ?? [];

  return (
    <article className="debug-card">
      <div className="debug-card__header">
        <div>
          <span className="debug-kicker">{connector}</span>
          <h2>{connector} connector</h2>
        </div>
        <div className={`debug-status debug-status--${integrationState?.status ?? "idle"}`}>
          <strong>{integrationState?.status ?? "idle"}</strong>
          <span>{integrationState?.accountLabel ?? "no account label"}</span>
        </div>
      </div>

      <div className="debug-form-grid">
        <label className="debug-field">
          <span>Scenario</span>
          <select value={control.scenario} onChange={(event) => onChange(connector, { scenario: event.target.value })}>
            {SCENARIOS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="debug-field">
          <span>Fixture</span>
          <select value={control.fixture} onChange={(event) => onChange(connector, { fixture: event.target.value })}>
            {fixtures.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="debug-field">
          <span>Delay (ms)</span>
          <input
            type="number"
            min="0"
            step="10"
            value={control.delayMs}
            onChange={(event) => onChange(connector, { delayMs: event.target.value })}
          />
        </label>
      </div>

      <div className="debug-actions">
        <button type="button" className="debug-button" onClick={() => onRunSync(connector)} disabled={control.running}>
          {control.running ? "Running..." : "Run sync"}
        </button>
      </div>

      <div className="debug-meta-grid">
        <div>
          <span>Last sync</span>
          <strong>{integrationState?.lastSyncAt ? new Date(integrationState.lastSyncAt).toLocaleString() : "never"}</strong>
        </div>
        <div>
          <span>Last error</span>
          <strong>{integrationState?.lastErrorCode ?? "none"}</strong>
        </div>
        <div>
          <span>Latest job</span>
          <strong>{latestJob?.status ?? "none"}</strong>
        </div>
      </div>
    </article>
  );
}

export function ConnectorDebugPage() {
  const client = useMemo(() => createSystemServiceClient(), []);
  const [apiKey, setApiKey] = useState(client.apiKey);
  const [state, setState] = useState(null);
  const [screenContext, setScreenContext] = useState(null);
  const [runtimeSummary, setRuntimeSummary] = useState(null);
  const [actionLog, setActionLog] = useState([]);
  const [stateTransitions, setStateTransitions] = useState([]);
  const [performanceSamples, setPerformanceSamples] = useState([]);
  const [adminStatus, setAdminStatus] = useState("checking");
  const [apiHealth, setApiHealth] = useState(null);
  const [apiHealthStatus, setApiHealthStatus] = useState("checking");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [manualFocusTitle, setManualFocusTitle] = useState("Manual focus from debug");
  const [performanceDraft, setPerformanceDraft] = useState({
    tier: "normal",
    avgFps: "60",
    reason: "manual",
  });
  const [otaDraft, setOtaDraft] = useState({
    targetVersion: "0.1.2",
  });
  const [creativeDraft, setCreativeDraft] = useState({
    transcript: "I feel scattered, but there is one useful idea I want to shape.",
    moodLabel: "scattered",
    moodIntensity: "0.7",
    careMode: "focus",
  });
  const [controls, setControls] = useState(() => ({
    calendar: { scenario: "success", fixture: "default", delayMs: "80", fixtures: FALLBACK_FIXTURES.calendar, running: false },
    todoist: { scenario: "success", fixture: "default", delayMs: "80", fixtures: FALLBACK_FIXTURES.todoist, running: false },
  }));
  const [jobs, setJobs] = useState({});
  const performanceDebug = getPerformanceDebugViewModel({
    system: state?.system,
    runtimeSummary,
    draftAvgFps: Number(performanceDraft.avgFps || 0),
  });

  useEffect(() => {
    client.setApiKey(apiKey);
  }, [apiKey, client]);

  useEffect(() => {
    let alive = true;

    async function loadFixtures(connector) {
      try {
        const response = await client.listConnectorFixtures(connector);
        return {
          fixtures: response.fixtures,
          fallback: false,
        };
      } catch (nextError) {
        if (nextError?.status === 404) {
          return {
            fixtures: FALLBACK_FIXTURES[connector],
            fallback: true,
          };
        }

        throw nextError;
      }
    }

    async function load() {
      try {
        const [nextState, nextScreenContext] = await Promise.all([
          client.getState(),
          client.getScreenContext(),
        ]);
        const [healthResult, calendarFixtures, todoistFixtures, runtimeResult, actionLogResult, transitionsResult, performanceResult] = await Promise.all([
          client.health().then((value) => ({ ok: true, value })).catch((nextError) => ({ ok: false, error: nextError })),
          loadFixtures("calendar"),
          loadFixtures("todoist"),
          client.getRuntimeSummary().then((value) => ({ ok: true, value })).catch((nextError) => ({ ok: false, error: nextError })),
          client.getRuntimeActionLog(12).then((value) => ({ ok: true, value })).catch(() => ({ ok: false, value: { items: [] } })),
          client.getRuntimeStateTransitions(12).then((value) => ({ ok: true, value })).catch(() => ({ ok: false, value: { items: [] } })),
          client.getRuntimePerformanceSamples(12).then((value) => ({ ok: true, value })).catch(() => ({ ok: false, value: { items: [] } })),
        ]);

        if (!alive) {
          return;
        }

        setState(nextState);
        setScreenContext(nextScreenContext);
        setApiHealth(healthResult.ok ? healthResult.value : null);
        setApiHealthStatus(healthResult.ok ? "ok" : "error");
        setRuntimeSummary(runtimeResult.ok ? runtimeResult.value : null);
        setActionLog(actionLogResult.value?.items ?? []);
        setStateTransitions(transitionsResult.value?.items ?? []);
        setPerformanceSamples(performanceResult.value?.items ?? []);
        setAdminStatus(runtimeResult.ok ? "available" : "required");
        setControls((current) => ({
          ...current,
          calendar: {
            ...current.calendar,
            fixtures: calendarFixtures.fixtures,
            fixture: calendarFixtures.fixtures.includes(current.calendar.fixture) ? current.calendar.fixture : calendarFixtures.fixtures[0] ?? "default",
          },
          todoist: {
            ...current.todoist,
            fixtures: todoistFixtures.fixtures,
            fixture: todoistFixtures.fixtures.includes(current.todoist.fixture) ? current.todoist.fixture : todoistFixtures.fixtures[0] ?? "default",
          },
        }));
        setNotice(
          calendarFixtures.fallback || todoistFixtures.fallback
            ? "Fixture endpoints unavailable on current API process. Using local fallback fixture names."
            : "",
        );
        setError("");
      } catch (nextError) {
        if (!alive) {
          return;
        }
        setError(nextError.message);
      }
    }

    load();
    const intervalId = window.setInterval(load, 1200);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [client]);

  function clearAdminKey() {
    client.setApiKey("");
    setApiKey("");
    setAdminStatus("required");
    setRuntimeSummary(null);
    setActionLog([]);
    setStateTransitions([]);
  }

  async function recheckApiHealth() {
    setApiHealthStatus("checking");
    try {
      const nextHealth = await client.health();
      setApiHealth(nextHealth);
      setApiHealthStatus("ok");
    } catch (nextError) {
      setApiHealth(null);
      setApiHealthStatus("error");
      setError(nextError.message);
    }
  }

  function updateControl(connector, patch) {
    setControls((current) => ({
      ...current,
      [connector]: {
        ...current[connector],
        ...patch,
      },
    }));
  }

  async function runSync(connector) {
    const control = controls[connector];
    updateControl(connector, { running: true });
    setError("");

    try {
      const job = await client.triggerConnectorSync(connector, {
        scenario: control.scenario,
        fixture: control.fixture,
        delayMs: Number(control.delayMs ?? 80),
      });

      setJobs((current) => ({
        ...current,
        [connector]: job,
      }));

      window.setTimeout(async () => {
        try {
          const nextJob = await client.getConnectorSyncJob(connector, job.id);
          const [nextRuntimeSummary, nextActionLog, nextStateTransitions] = await Promise.all([
            client.getRuntimeSummary().catch(() => null),
            client.getRuntimeActionLog(12).catch(() => ({ items: [] })),
            client.getRuntimeStateTransitions(12).catch(() => ({ items: [] })),
          ]);
          setJobs((current) => ({
            ...current,
            [connector]: nextJob,
          }));
          setRuntimeSummary(nextRuntimeSummary);
          setActionLog(nextActionLog?.items ?? []);
          setStateTransitions(nextStateTransitions?.items ?? []);
        } catch {
          // Keep last accepted job snapshot on polling failures.
        } finally {
          updateControl(connector, { running: false });
        }
      }, Math.max(120, Number(control.delayMs ?? 80) + 40));
    } catch (nextError) {
      updateControl(connector, { running: false });
      setError(nextError.message);
    }
  }

  async function applyManualFocus() {
    setError("");

    try {
      await client.sendAction("screen_set_focus_item", { title: manualFocusTitle }, "debug_surface");
      const [nextState, nextScreenContext, nextRuntimeSummary, nextActionLog, nextStateTransitions] = await Promise.all([
        client.getState(),
        client.getScreenContext(),
        client.getRuntimeSummary().catch(() => null),
        client.getRuntimeActionLog(12).catch(() => ({ items: [] })),
        client.getRuntimeStateTransitions(12).catch(() => ({ items: [] })),
      ]);
      setState(nextState);
      setScreenContext(nextScreenContext);
      setRuntimeSummary(nextRuntimeSummary);
      setActionLog(nextActionLog?.items ?? []);
      setStateTransitions(nextStateTransitions?.items ?? []);
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function refreshRuntimePanels() {
    const [runtimeResult, actionLogResult, transitionsResult, performanceResult] = await Promise.all([
      client.getRuntimeSummary().then((value) => ({ ok: true, value })).catch((nextError) => ({ ok: false, error: nextError })),
      client.getRuntimeActionLog(12).then((value) => ({ ok: true, value })).catch(() => ({ ok: false, value: { items: [] } })),
      client.getRuntimeStateTransitions(12).then((value) => ({ ok: true, value })).catch(() => ({ ok: false, value: { items: [] } })),
      client.getRuntimePerformanceSamples(12).then((value) => ({ ok: true, value })).catch(() => ({ ok: false, value: { items: [] } })),
    ]);
    setRuntimeSummary(runtimeResult.ok ? runtimeResult.value : null);
    setActionLog(actionLogResult.value?.items ?? []);
    setStateTransitions(transitionsResult.value?.items ?? []);
    setPerformanceSamples(performanceResult.value?.items ?? []);
    setAdminStatus(runtimeResult.ok ? "available" : "required");
  }

  async function applyPerformanceTier() {
    setError("");

    try {
      await client.sendAction(
        "runtime_set_performance_tier",
        {
          tier: performanceDraft.tier,
          reason: performanceDraft.reason || "manual",
        },
        "debug_surface",
      );
      await refreshRuntimePanels();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function reportPerformanceSample() {
    setError("");

    try {
      await client.sendAction(
        "runtime_report_performance",
        {
          avgFps: Number(performanceDraft.avgFps || 0),
          reason: performanceDraft.reason || "manual",
        },
        "debug_surface",
      );
      await refreshRuntimePanels();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function runOtaStep(step) {
    setError("");

    try {
      if (step === "check") {
        await client.checkOta({ targetVersion: otaDraft.targetVersion, source: "debug_surface" });
      } else if (step === "apply") {
        await client.applyOta({ source: "debug_surface" });
      } else {
        await client.rollbackOta({ source: "debug_surface" });
      }

      const nextState = await client.getState();
      setState(nextState);
      await refreshRuntimePanels();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function submitCreativeCareSample() {
    setError("");

    try {
      await client.sendAction(
        "voice_capture_submit",
        {
          transcript: creativeDraft.transcript,
          moodLabel: creativeDraft.moodLabel,
          moodIntensity: Number(creativeDraft.moodIntensity || 0),
          careMode: creativeDraft.careMode,
          source: "debug_surface",
        },
        "debug_surface",
      );
      const [nextState, nextRuntimeSummary, nextActionLog, nextStateTransitions] = await Promise.all([
        client.getState(),
        client.getRuntimeSummary().catch(() => null),
        client.getRuntimeActionLog(12).catch(() => ({ items: [] })),
        client.getRuntimeStateTransitions(12).catch(() => ({ items: [] })),
      ]);
      setState(nextState);
      setRuntimeSummary(nextRuntimeSummary);
      setActionLog(nextActionLog?.items ?? []);
      setStateTransitions(nextStateTransitions?.items ?? []);
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function clearCreativeCareSample() {
    setError("");

    try {
      await client.sendAction("voice_reflection_clear", {}, "debug_surface");
      const [nextState, nextRuntimeSummary, nextActionLog, nextStateTransitions] = await Promise.all([
        client.getState(),
        client.getRuntimeSummary().catch(() => null),
        client.getRuntimeActionLog(12).catch(() => ({ items: [] })),
        client.getRuntimeStateTransitions(12).catch(() => ({ items: [] })),
      ]);
      setState(nextState);
      setRuntimeSummary(nextRuntimeSummary);
      setActionLog(nextActionLog?.items ?? []);
      setStateTransitions(nextStateTransitions?.items ?? []);
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  return (
    <main className="debug-page">
      <section className="debug-shell">
        <header className="debug-hero">
          <div>
            <span className="debug-kicker">Batch E</span>
            <h1>Connector debug surface</h1>
            <p>Run mock Calendar and Todoist sync jobs, switch fixtures, and watch ScreenContext change in place.</p>
          </div>
          <label className="debug-field debug-field--hero">
            <span>Admin API key</span>
            <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="dev-admin-key" />
          </label>
        </header>

        <section className="debug-auth-strip">
          <div className={`debug-status debug-status--${apiHealthStatus}`}>
            <strong>{apiHealthStatus === "ok" ? "API connected" : apiHealthStatus === "checking" ? "Checking API" : "API offline"}</strong>
            <span>{client.baseUrl} · {apiHealth?.service ?? "system api"}</span>
          </div>
          <div className={`debug-status debug-status--${adminStatus === "available" ? "ok" : adminStatus}`}>
            <strong>{adminStatus === "available" ? "Admin connected" : adminStatus === "checking" ? "Checking admin" : "Admin key needed"}</strong>
            <span>
              {adminStatus === "available"
                ? "Runtime logs, connector sync, OTA, and debug actions are enabled."
                : "Read-only state still loads, but runtime logs and write actions need TIKPAL_API_KEY."}
            </span>
          </div>
          <div className="debug-status">
            <strong>{apiKey ? "Key present" : "No key stored"}</strong>
            <span>{apiKey ? `Source: ${getAdminKeySource()}` : "Start API with TIKPAL_API_KEY, then enter it here."}</span>
          </div>
          <div className="debug-status">
            <strong>Debug URL</strong>
            <span>{getDebugEntryUrl()} · Alt {getDebugPathUrl()}</span>
          </div>
          <div className="debug-auth-actions">
            <button type="button" className="debug-button debug-button--ghost" onClick={recheckApiHealth}>
              Recheck API
            </button>
            <button type="button" className="debug-button debug-button--ghost" onClick={refreshRuntimePanels}>
              Recheck admin
            </button>
            <button type="button" className="debug-button debug-button--ghost" onClick={clearAdminKey}>
              Clear key
            </button>
          </div>
        </section>

        {error ? <p className="debug-error">{error}</p> : null}
        {notice ? <p className="debug-notice">{notice}</p> : null}

        <section className="debug-manual-focus">
          <label className="debug-field">
            <span>Manual focus item</span>
            <input value={manualFocusTitle} onChange={(event) => setManualFocusTitle(event.target.value)} placeholder="Set Screen focus title" />
          </label>
          <button type="button" className="debug-button" onClick={applyManualFocus}>
            Apply manual focus
          </button>
        </section>

        <section className="debug-manual-focus">
          <label className="debug-field">
            <span>Performance tier</span>
            <select value={performanceDraft.tier} onChange={(event) => setPerformanceDraft((current) => ({ ...current, tier: event.target.value }))}>
              {["normal", "reduced", "safe"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="debug-field">
            <span>avgFps</span>
            <input value={performanceDraft.avgFps} onChange={(event) => setPerformanceDraft((current) => ({ ...current, avgFps: event.target.value }))} />
          </label>
          <label className="debug-field">
            <span>Reason</span>
            <input value={performanceDraft.reason} onChange={(event) => setPerformanceDraft((current) => ({ ...current, reason: event.target.value }))} />
          </label>
          <button type="button" className="debug-button" onClick={applyPerformanceTier}>
            Set tier
          </button>
          <button type="button" className="debug-button debug-button--ghost" onClick={reportPerformanceSample}>
            Report sample
          </button>
          <div className="debug-meta-grid debug-meta-grid--inline">
            <div>
              <span>Current tier</span>
              <strong>{performanceDebug.tier}</strong>
            </div>
            <div>
              <span>Suggested</span>
              <strong>{performanceDebug.suggestedTier}</strong>
            </div>
            <div>
              <span>Latency</span>
              <strong>{performanceDebug.interactionLatencyMs ?? "n/a"}ms</strong>
            </div>
            <div>
              <span>Memory</span>
              <strong>{performanceDebug.memoryUsageMb ?? "n/a"} MB</strong>
            </div>
            <div>
              <span>Budget</span>
              <strong>{performanceDebug.budgetLabel}</strong>
            </div>
            <div>
              <span>Reason</span>
              <strong>{performanceDebug.lastDegradeReason ?? "none"}</strong>
            </div>
          </div>
        </section>

        <section className="debug-manual-focus">
          <label className="debug-field">
            <span>OTA target</span>
            <input value={otaDraft.targetVersion} onChange={(event) => setOtaDraft({ targetVersion: event.target.value })} />
          </label>
          <button type="button" className="debug-button" onClick={() => runOtaStep("check")}>
            Check OTA
          </button>
          <button type="button" className="debug-button debug-button--ghost" onClick={() => runOtaStep("apply")}>
            Apply OTA
          </button>
          <button type="button" className="debug-button debug-button--ghost" onClick={() => runOtaStep("rollback")}>
            Rollback OTA
          </button>
        </section>

        <section className="debug-card debug-card--wide">
          <div className="debug-card__header">
            <div>
              <span className="debug-kicker">Creative Care</span>
              <h2>Voice capture state</h2>
            </div>
            <div className="debug-status debug-status--ok">
              <strong>{state?.creativeCare?.moodLabel ?? "clear"}</strong>
              <span>{state?.creativeCare?.currentCareMode ?? "flow"} · {state?.creativeCare?.suggestedFlowState ?? "flow"}</span>
            </div>
          </div>
          <div className="debug-form-grid debug-form-grid--creative">
            <label className="debug-field debug-field--span-2">
              <span>Transcript sample</span>
              <textarea
                value={creativeDraft.transcript}
                onChange={(event) => setCreativeDraft((current) => ({ ...current, transcript: event.target.value }))}
                rows={3}
              />
            </label>
            <label className="debug-field">
              <span>Mood</span>
              <select value={creativeDraft.moodLabel} onChange={(event) => setCreativeDraft((current) => ({ ...current, moodLabel: event.target.value }))}>
                {CREATIVE_MOODS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="debug-field">
              <span>Intensity</span>
              <input
                value={creativeDraft.moodIntensity}
                onChange={(event) => setCreativeDraft((current) => ({ ...current, moodIntensity: event.target.value }))}
              />
            </label>
            <label className="debug-field">
              <span>Care mode</span>
              <select value={creativeDraft.careMode} onChange={(event) => setCreativeDraft((current) => ({ ...current, careMode: event.target.value }))}>
                {CREATIVE_CARE_MODES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="debug-actions">
            <button type="button" className="debug-button" onClick={submitCreativeCareSample}>
              Submit voice sample
            </button>
            <button type="button" className="debug-button debug-button--ghost" onClick={clearCreativeCareSample}>
              Clear reflection
            </button>
          </div>
          <div className="debug-meta-grid">
            <div>
              <span>Insight</span>
              <strong>{state?.creativeCare?.insightSentence ?? "none"}</strong>
            </div>
            <div>
              <span>Capture length</span>
              <strong>{state?.creativeCare?.metadata?.captureLength ?? 0}</strong>
            </div>
            <div>
              <span>Updated</span>
              <strong>{state?.creativeCare?.updatedAt ? new Date(state.creativeCare.updatedAt).toLocaleString() : "never"}</strong>
            </div>
          </div>
        </section>

        <section className="debug-grid">
          {CONNECTORS.map((connector) => (
            <ConnectorControlCard
              key={connector}
              connector={connector}
              control={controls[connector]}
              onChange={updateControl}
              onRunSync={runSync}
              integrationState={state?.integrations?.[connector]}
              latestJob={jobs[connector]}
            />
          ))}
        </section>

        <section className="debug-panels">
          <article className="debug-panel">
            <span className="debug-kicker">RuntimeSummary</span>
            <pre>{prettyJson(runtimeSummary ?? {})}</pre>
          </article>
          <article className="debug-panel">
            <span className="debug-kicker">ScreenContext</span>
            <pre>{prettyJson(screenContext ?? {})}</pre>
          </article>
          <article className="debug-panel">
            <span className="debug-kicker">Integrations State</span>
            <pre>{prettyJson(state?.integrations ?? {})}</pre>
          </article>
          <article className="debug-panel">
            <span className="debug-kicker">CreativeCare</span>
            <pre>{prettyJson(state?.creativeCare ?? {})}</pre>
          </article>
          <article className="debug-panel">
            <span className="debug-kicker">PerformanceSamples</span>
            <pre>{prettyJson(performanceSamples)}</pre>
          </article>
          <article className="debug-panel">
            <span className="debug-kicker">ActionTimeline</span>
            <pre>{prettyJson(actionLog)}</pre>
          </article>
          <article className="debug-panel">
            <span className="debug-kicker">StateTransitions</span>
            <pre>{prettyJson(stateTransitions)}</pre>
          </article>
        </section>
      </section>
    </main>
  );
}
