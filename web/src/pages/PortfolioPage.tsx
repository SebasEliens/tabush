import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, Banknote, Gauge, Home } from "lucide-react";
import { api } from "../api/client";
import type { PortfolioSummary, RuralProperty } from "../api/types";
import { riskRamp } from "../design/tokens";
import { brl, brlCompact, pct, statusText, statusTone, worstSeverity } from "../format";
import { useTenant } from "../tenant";
import { ButtonLink, Card, Skeleton, Stat, StatusBadge, riskLevel } from "../ui";
import { Landscape } from "../ui/Landscape";

export function PortfolioPage() {
  const { tenant } = useTenant();
  const [summary, setSummary] = useState<PortfolioSummary>();
  const [props, setProps] = useState<RuralProperty[]>([]);
  useEffect(() => {
    if (!tenant) return;
    setSummary(undefined);
    api.portfolioSummary(tenant.id).then(setSummary);
    api.listProperties(tenant.id).then(setProps);
  }, [tenant]);

  const rows = [...props].sort((a, b) => b.risk.overall - a.risk.overall);
  const blocked = rows.filter((p) => worstSeverity(p) === "block");
  const maxBucket = Math.max(...(summary?.riskBuckets.map((b) => b.count) ?? [1]), 1);
  const bucketColor = [riskRamp[1], riskRamp[2], riskRamp[4]];

  return (
    <div className="page">
      <div className="hero">
        <Landscape height={200} />
        <div className="hero__text">
          <h1>{tenant?.name ?? "Portfolio"}</h1>
          <p>Rural credit portfolio · Canguçu, RS · data snapshot 1 Nov 2026</p>
        </div>
      </div>

      <div className="stat-grid">
        {summary ? (
          <>
            <Stat icon={Home} label="Properties" value={summary.properties} hint="with an active loan" />
            <Stat icon={Banknote} label="Credit exposure" value={brlCompact(summary.exposureBrl)} hint={brl(summary.exposureBrl)} />
            <Stat icon={AlertOctagon} label="Blocked" tone="danger" value={summary.blockedCount} hint={`${pct(summary.flaggedPct)} flagged in total`} />
            <Stat icon={Gauge} label="Mean climate risk" value={summary.meanRisk.toFixed(2)} hint={riskLevel(summary.meanRisk).label} />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <div key={i} className="ui-card ui-stat stack-2"><Skeleton width="50%" /><Skeleton width="70%" height={28} /></div>)
        )}
      </div>

      <div className="two-col">
        <Card title="Needs attention" description="Blocked properties, highest climate risk first." actions={<ButtonLink to="/alerts" size="sm" variant="ghost">See alerts</ButtonLink>}>
          <ul className="attention">
            {blocked.slice(0, 5).map((p) => (
              <li key={p.carCode}>
                <div className="stack-1">
                  <Link to={`/?car=${encodeURIComponent(p.carCode)}`}><strong>{p.name}</strong></Link>
                  <div className="text-sm text-secondary">{p.flags.find((f) => f.severity === "block")?.detail}</div>
                </div>
                <span className="num text-sm">{brl(p.loans.reduce((a, l) => a + l.amountBrl, 0))}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Risk distribution" description="Properties by overall climate risk score.">
          <div className="dist">
            {summary?.riskBuckets.map((b, i) => (
              <div className="dist__row" key={b.label}>
                <span className="text-sm">{b.label.replace(/ \(.*\)/, "")}<span className="text-muted"> {b.label.match(/\((.*)\)/)?.[1]}</span></span>
                <span className="dist__track"><span className="dist__fill" style={{ display: "block", width: `${(b.count / maxBucket) * 100}%`, background: bucketColor[i] }} /></span>
                <span className="num">{b.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="All properties" description="Sorted by overall climate risk. Select a name to open it on the map.">
        <div className="table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Property</th><th>Crop</th><th className="num">Area</th><th>Verdict</th>
                <th className="num">Drought</th><th className="num">Flood</th><th className="num">Overall</th><th className="num">Exposure</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const s = worstSeverity(p);
                return (
                  <tr key={p.carCode}>
                    <td>
                      <Link to={`/?car=${encodeURIComponent(p.carCode)}`}>{p.name}</Link>
                      <div className="mono text-xs text-muted">{p.carCode}</div>
                    </td>
                    <td>{p.mainCrop}</td>
                    <td className="num">{p.areaHa} ha</td>
                    <td><StatusBadge tone={statusTone[s]}>{statusText[s]}</StatusBadge></td>
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
      </Card>
    </div>
  );
}
