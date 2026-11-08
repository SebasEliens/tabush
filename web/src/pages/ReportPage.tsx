import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../api/client";
import type { FlagType, RuralProperty } from "../api/types";
import { brl, flagLabel, statusText, statusTone, verdict, worstSeverity } from "../format";
import { useTenant } from "../tenant";
import { Button, Callout, Eyebrow, Meter, StatusBadge } from "../ui";
import { Logo } from "../ui/Logo";

const checks: FlagType[] = ["car_status", "indigenous_land", "quilombola_territory", "protected_area", "embargo", "deforestation", "car_overlap", "lista_suja"];

// Printable compliance report. The real one is rendered server-side to PDF
// and tied to a data snapshot id; this mock uses the browser's print dialog.
export function ReportPage() {
  const { carCode = "" } = useParams();
  const { tenant } = useTenant();
  const [p, setP] = useState<RuralProperty | null>();
  useEffect(() => {
    if (tenant) api.getProperty(tenant.id, carCode).then((x) => setP(x ?? null));
  }, [tenant, carCode]);
  if (p === undefined) return <div className="report report__body">Loading…</div>;
  if (p === null) return <div className="report report__body">This property is not in your institution's portfolio.</div>;
  const s = worstSeverity(p);
  const v = verdict[s === "info" ? "ok" : s];
  return (
    <article className="report">
      <header className="report__band">
        <Logo tone="on-brand" />
        <Button className="no-print" variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>Print or save as PDF</Button>
      </header>
      <div className="report__body">
        <div className="stack-1">
          <Eyebrow>Socio-environmental compliance report</Eyebrow>
          <h1 className="report__title">{p.name}</h1>
          <p className="text-secondary text-sm">
            <span className="mono">{p.carCode}</span> · {p.municipality}/RS · {p.areaHa} ha · prepared for {tenant?.name} · snapshot 2026-11-01 · report MOCK-{p.carCode.slice(-6)}
          </p>
        </div>
        <Callout tone={statusTone[s]} title={v.title}>{v.body}</Callout>
        <section className="stack-2">
          <h2>Checks performed</h2>
          <table className="ui-table">
            <thead><tr><th>Check</th><th>Result</th><th>Source</th></tr></thead>
            <tbody>
              {checks.map((t) => {
                const f = p.flags.find((x) => x.type === t);
                return (
                  <tr key={t}>
                    <td>{flagLabel[t]}</td>
                    <td>{f ? <div className="stack-1"><StatusBadge tone={statusTone[f.severity]}>{statusText[f.severity]}</StatusBadge><div>{f.detail}</div></div> : <StatusBadge tone="success">No finding</StatusBadge>}</td>
                    <td className="text-xs text-secondary">{f?.source ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="stack-3">
          <h2>Climate risk</h2>
          <Meter label="Drought" value={p.risk.drought} />
          <Meter label="Flood" value={p.risk.flood} />
          <Meter label="Heat" value={p.risk.heat} />
          <Meter label="Overall" value={p.risk.overall} />
          <p className="text-sm text-secondary">Expected yield loss {p.risk.expectedYieldLossPct}% · ZARC class {p.risk.zarcClass} · risk model v0.1</p>
        </section>
        <section className="stack-2">
          <h2>Credit exposure</h2>
          <p>{p.loans.map((l) => `${l.product}: ${brl(l.amountBrl)}`).join(" · ")}</p>
        </section>
        <p className="text-xs text-muted">Mock report generated from fake data for design review. Not a real assessment.</p>
      </div>
    </article>
  );
}
