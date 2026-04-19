import { FLOW_ORDER, FLOW_THEME } from "../theme";

export function PreviewGallery() {
  return (
    <main className="preview-page">
      <header className="preview-page__header">
        <div>
          <p className="preview-page__eyebrow">Flow Mode Preview</p>
          <h1>tikpal-speaker</h1>
        </div>
        <a className="preview-page__link" href="/?mode=overview">
          Open Main View
        </a>
      </header>

      <section className="preview-grid">
        {FLOW_ORDER.map((state) => {
          const theme = FLOW_THEME[state];

          return (
            <article key={state} className="preview-card">
              <div className="preview-card__meta">
                <div>
                  <p className="preview-card__state">{theme.label}</p>
                  <p className="preview-card__subtitle">{theme.subtitle}</p>
                </div>
                <a className="preview-card__open" href={`/?mode=flow&state=${state}`}>
                  Open
                </a>
              </div>

              <div
                className="preview-card__swatch"
                style={{
                  background: `linear-gradient(135deg, ${theme.bgGradient.join(", ")})`,
                }}
              >
                <div
                  className="preview-card__glow"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, ${theme.glow} 0%, transparent 58%)`,
                  }}
                />
                <iframe
                  title={`${state} preview`}
                  src={`/?mode=flow&state=${state}`}
                  className="preview-card__frame"
                />
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
