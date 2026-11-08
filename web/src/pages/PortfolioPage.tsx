import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { PortfolioSummary, RuralProperty } from "../api/types";
import { brl, pct, severityText, worstSeverity } from "../format";
import { useTenant } from "../tenant";

export function PortfolioPage() {
  const { tenant } = useTenant();
  const [summary, setSummary] = useState<PortfolioSummary>();
  const [props, setProps] = useState<RuralProperty[]>([]);
  useEffect(() => {
    if (!tenant) return;
    api.portfolioSummary(tenant.id).then(setSummary);
    api.listProperties(tenant.id).then(setProps);
  }, [tenant]);
  if (!summary) return <div className="page muted">Loading…</div>;
  const maxBucket = Math.max(...summary.riskBuckets.map((b) => b.count), 1);
  const rows = [...props].sort((a, b) => b.risk.overall - a.risk.overall);

  return (
    <div className="page">
      <h1>Portfolio · {tenant?.name}</h1>
      <div className="tiles">
        <Tile label="Properties" value={String(summary.properties)} />
        <Tile label="Credit exposure" value={brl(summary.exposureBrl)} />
        <Tile label="Flagged for review" value={pct(summary.flaggedPct)} />
        <Tile label="Blocked" value={String(summary.blockedCount)} />
        <Tile label="Mean climate risk" value={summary.meanRisk.toFixed(2)} />
      </div>

      <div className="card">
        <h3>Risk distribution</h3>
        {summary.riskBuckets.map((b) => (
          <div className="hbar" key={b.label}>
            <span className="hbar-label">{b.label}</span>
            <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(b.count / maxBucket) * 100}%` }} /></span>
            <span className="hbar-value">{b.count}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Properties by risk</h3>
        <table className="table">
          <thead>
            <tr><th>Property</th><th>CAR</th><th className="num">Area (ha)</th><th>Crop</th><th>Status</th><th className="num">Drought</th><th className="num">Flood</th><th className="num">Overall</th><th className="num">Exposure</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const s = worstSeverity(p);
              return (
                <tr key={p.carCode}>
                  <td><Link to={`/?car=${encodeURIComponent(p.carCode)}`}>{p.name}</Link></td>
                  <td className="mono small">{p.carCode}</td>
                  <td className="num">{p.areaHa}</td>
                  <td>{p.mainCrop}</td>
                  <td><span className={`pill pill-${s}`}>{severityText[s]}</span></td>
                  <td className="num">{p.risk.drought.toFixed(2)}</td>
                  <td className="num">{p.risk.flood.toFixed(2)}</td>
                  <td className="num"><strong>{p.risk.overall.toFixed(2)}</strong></td>
                  <td className="num">{brl(p.loans.reduce((a, l) => a + l.amountBrl, 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
    </div>
  );
}
