import { Link } from "react-router-dom";
import type { RuralProperty } from "../api/types";
import { brl, flagLabel, pct, severityText, worstSeverity } from "../format";

export function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="scorebar">
      <span className="scorebar-label">{label}</span>
      <span className="scorebar-track">
        <span className="scorebar-fill" style={{ width: pct(value), background: value > 0.6 ? "#d9472b" : value > 0.35 ? "#f6a15a" : "#e9c46a" }} />
      </span>
      <span className="scorebar-value">{value.toFixed(2)}</span>
    </div>
  );
}

export function PropertyPanel({ p, onClose }: { p: RuralProperty; onClose: () => void }) {
  const status = worstSeverity(p);
  return (
    <aside className="panel">
      <header className="panel-head">
        <div>
          <h2>{p.name}</h2>
          <div className="muted mono">{p.carCode}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
      </header>

      <div className={`status-banner status-${status}`}>
        <strong>{severityText[status]}</strong>
        <span>{p.flags.filter((f) => f.severity !== "info").length} compliance flag(s)</span>
      </div>

      <dl className="facts">
        <dt>Municipality</dt><dd>{p.municipality} ({p.ibgeCode})</dd>
        <dt>Area</dt><dd>{p.areaHa} ha</dd>
        <dt>Main crop</dt><dd>{p.mainCrop}</dd>
        <dt>CAR status</dt><dd className={`car-${p.carStatus}`}>{p.carStatus}</dd>
        <dt>Holder</dt><dd className="mono">{p.holderHash}</dd>
      </dl>

      <section>
        <h3>Compliance check</h3>
        {p.flags.length === 0 && <p className="muted">No overlaps, embargoes or deforestation found.</p>}
        <ul className="flags">
          {p.flags.map((f, i) => (
            <li key={i} className={`flag flag-${f.severity}`}>
              <div className="flag-title">{flagLabel[f.type]}</div>
              <div>{f.detail}</div>
              <div className="muted small">Source: {f.source} · snapshot {f.snapshotDate}</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Climate risk</h3>
        <ScoreBar label="Drought" value={p.risk.drought} />
        <ScoreBar label="Flood" value={p.risk.flood} />
        <ScoreBar label="Heat" value={p.risk.heat} />
        <ScoreBar label="Overall" value={p.risk.overall} />
        <p className="muted small">
          Expected yield loss {p.risk.expectedYieldLossPct}% · ZARC class {p.risk.zarcClass} · model v0.1 (mock)
        </p>
      </section>

      <section>
        <h3>Loans</h3>
        <table className="mini">
          <tbody>
            {p.loans.map((l) => (
              <tr key={l.id}><td className="mono">{l.id}</td><td>{l.product}</td><td className="num">{brl(l.amountBrl)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      {p.practices.length > 0 && (
        <section>
          <h3>Adaptation practices</h3>
          <p>{p.practices.join(", ")} <span className="muted small">(awaiting imagery verification)</span></p>
        </section>
      )}

      <Link className="btn primary" to={`/report/${encodeURIComponent(p.carCode)}`} target="_blank">
        Open compliance report
      </Link>
    </aside>
  );
}
