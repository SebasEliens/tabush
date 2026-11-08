import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import type { RuralProperty } from "../api/types";
import { brl, flagLabel, severityText, worstSeverity } from "../format";
import { useTenant } from "../tenant";

// Printable compliance report. The real one is rendered server-side to PDF
// and tied to a data snapshot id; this mock uses the browser's print dialog.
export function ReportPage() {
  const { carCode = "" } = useParams();
  const { tenant } = useTenant();
  const [p, setP] = useState<RuralProperty | null>();
  useEffect(() => {
    if (tenant) api.getProperty(tenant.id, carCode).then((x) => setP(x ?? null));
  }, [tenant, carCode]);
  if (p === undefined) return <div className="report">Loading…</div>;
  if (p === null) return <div className="report">Property not found for this institution.</div>;
  const s = worstSeverity(p);
  return (
    <div className="report">
      <button className="btn no-print" onClick={() => window.print()}>Print / save as PDF</button>
      <h1>Socio-environmental compliance report</h1>
      <p className="muted">Prepared for {tenant?.name} · data snapshot 2026-11-01 · report id MOCK-{p.carCode.slice(-6)}</p>
      <h2>{p.name}</h2>
      <table className="table">
        <tbody>
          <tr><th>CAR code</th><td className="mono">{p.carCode}</td></tr>
          <tr><th>Municipality</th><td>{p.municipality} / RS ({p.ibgeCode})</td></tr>
          <tr><th>Declared area</th><td>{p.areaHa} ha</td></tr>
          <tr><th>CAR status</th><td>{p.carStatus}</td></tr>
          <tr><th>Outcome</th><td><span className={`pill pill-${s}`}>{severityText[s]}</span></td></tr>
        </tbody>
      </table>
      <h3>Checks performed</h3>
      <table className="table">
        <thead><tr><th>Check</th><th>Result</th><th>Source</th></tr></thead>
        <tbody>
          {(["car_status", "indigenous_land", "quilombola_territory", "protected_area", "embargo", "deforestation", "car_overlap", "lista_suja"] as const).map((t) => {
            const f = p.flags.find((x) => x.type === t);
            return (
              <tr key={t}>
                <td>{flagLabel[t]}</td>
                <td>{f ? <span className={`pill pill-${f.severity === "info" ? "ok" : f.severity}`}>{f.detail}</span> : "No finding"}</td>
                <td className="small">{f?.source ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>Climate risk</h3>
      <p>Drought {p.risk.drought.toFixed(2)} · Flood {p.risk.flood.toFixed(2)} · Heat {p.risk.heat.toFixed(2)} · Overall {p.risk.overall.toFixed(2)} · expected yield loss {p.risk.expectedYieldLossPct}%</p>
      <h3>Credit exposure</h3>
      <p>{p.loans.map((l) => `${l.product} ${brl(l.amountBrl)}`).join("; ")}</p>
      <p className="muted small">Mock report generated from fake data for UI review. Not a real assessment.</p>
    </div>
  );
}
