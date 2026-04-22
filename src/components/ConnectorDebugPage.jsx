import { useEffect, useMemo, useState } from "react";
import { createSystemServiceClient } from "../bridge/systemServiceClient";

const CONNECTORS = ["calendar", "todoist"];
const SCENARIOS = ["success", "stale", "error"];
const FALLBACK_FIXTURES = {
  calendar: ["default", "meeting_heavy", "afternoon_focus"],
  todoist: ["default", "writing_day", "triage_day"],
};

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [manualFocusTitle, setManualFocusTitle] = useState("Manual focus from debug");
  const [controls, setControls] = useState(() => ({
    calendar: { scenario: "success", fixture: "default", delayMs: "80", fixtures: FALLBACK_FIXTURES.calendar, running: false },
    todoist: { scenario: "success", fixture: "default", delayMs: "80", fixtures: FALLBACK_FIXTURES.todoist, running: false },
  }));
  const [jobs, setJobs] = useState({});

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
        const [calendarFixtures, todoistFixtures] = await Promise.all([
          loadFixtures("calendar"),
          loadFixtures("todoist"),
        ]);

        if (!alive) {
          return;
        }

        setState(nextState);
        setScreenContext(nextScreenContext);
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
          setJobs((current) => ({
            ...current,
            [connector]: nextJob,
          }));
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
      const [nextState, nextScreenContext] = await Promise.all([client.getState(), client.getScreenContext()]);
      setState(nextState);
      setScreenContext(nextScreenContext);
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
            <span className="debug-kicker">ScreenContext</span>
            <pre>{prettyJson(screenContext ?? {})}</pre>
          </article>
          <article className="debug-panel">
            <span className="debug-kicker">Integrations State</span>
            <pre>{prettyJson(state?.integrations ?? {})}</pre>
          </article>
        </section>
      </section>
    </main>
  );
}
