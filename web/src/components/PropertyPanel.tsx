import { useState } from "react";
import { Check, Copy, FileText, MousePointerClick, Search, SlidersHorizontal } from "lucide-react";
import type { PortfolioSummary, RuralProperty } from "../api/types";
import { brl, flagLabel, statusText, statusTone, verdict, worstSeverity } from "../format";
import { Button, ButtonLink, Callout, Disclosure, Eyebrow, Kbd, Meter, StatusBadge } from "../ui";
import { Landscape } from "../ui/Landscape";

export function PropertyPanel({ p, onClose }: { p: RuralProperty; onClose: () => void }) {
  const status = worstSeverity(p);
  const v = verdict[status === "info" ? "ok" : status];
  const findings = p.flags.filter((f) => f.severity !== "info");
  const exposure = p.loans.reduce((a, l) => a + l.amountBrl, 0);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(p.carCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className="panel" aria-label={`Property ${p.name}`}>
      <div className="panel__body">
        {/* 1. Who and what: identity first */}
        <div>
          <div className="row-between">
            <Eyebrow>Rural property · {p.municipality}</Eyebrow>
            <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          </div>
          <h2 className="panel__title">{p.name}</h2>
          <div className="panel__car">
            <span className="mono text-sm">{p.carCode}</span>
            <Button variant="ghost" size="sm" iconOnly icon={copied ? Check : Copy} onClick={copy} aria-label="Copy CAR code" title="Copy CAR code" />
          </div>
        </div>

        {/* 2. The decision, in plain language */}
        <Callout tone={statusTone[status]} title={v.title}>
          {findings.length > 0 ? (
            <ul className="reasons">
              {findings.map((f, i) => <li key={i}>{f.detail}</li>)}
            </ul>
          ) : v.body}
        </Callout>

        {/* 3. Climate risk, with words as well as numbers */}
        <section className="stack-3" aria-labelledby="risk-h">
          <div className="row-between">
            <h3 id="risk-h">Climate risk</h3>
            <span className="text-sm text-secondary">Expected yield loss {p.risk.expectedYieldLossPct}%</span>
          </div>
          <Meter label="Drought" value={p.risk.drought} />
          <Meter label="Flood" value={p.risk.flood} />
          <Meter label="Heat" value={p.risk.heat} />
          <Meter label="Overall" value={p.risk.overall} />
        </section>

        <div className="panel__actions">
          <ButtonLink variant="primary" icon={FileText} to={`/report/${encodeURIComponent(p.carCode)}`} target="_blank">
            Compliance report
          </ButtonLink>
        </div>

        {/* 4. Details on demand */}
        <div>
          <Disclosure title="All checks and sources" meta={`${p.flags.length} finding${p.flags.length === 1 ? "" : "s"}`}>
            {p.flags.length === 0 ? (
              <p className="text-secondary">No findings in any source.</p>
            ) : (
              <ul className="flag-list">
                {p.flags.map((f, i) => (
                  <li key={i}>
                    <div className="row-between">
                      <strong>{flagLabel[f.type]}</strong>
                      <StatusBadge tone={statusTone[f.severity]}>{statusText[f.severity]}</StatusBadge>
                    </div>
                    <span>{f.detail}</span>
                    <span className="text-xs text-muted">{f.source} · snapshot {f.snapshotDate}</span>
                  </li>
                ))}
              </ul>
            )}
          </Disclosure>
          <Disclosure title="Loans" meta={brl(exposure)}>
            <ul className="flag-list">
              {p.loans.map((l) => (
                <li key={l.id}>
                  <div className="row-between"><strong>{l.product}</strong><span className="num">{brl(l.amountBrl)}</span></div>
                  <span className="text-xs text-muted"><span className="mono">{l.id}</span> · matures {l.maturity}</span>
                </li>
              ))}
            </ul>
          </Disclosure>
          <Disclosure title="Property facts">
            <dl className="facts">
              <dt>Area</dt><dd>{p.areaHa} ha</dd>
              <dt>Main crop</dt><dd>{p.mainCrop}</dd>
              <dt>CAR status</dt><dd>{p.carStatus}</dd>
              <dt>ZARC class</dt><dd>{p.risk.zarcClass}</dd>
              <dt>Municipality</dt><dd>{p.municipality} ({p.ibgeCode})</dd>
              <dt>Holder</dt><dd className="mono text-sm">{p.holderHash}</dd>
            </dl>
          </Disclosure>
          <Disclosure title="Adaptation practices" meta={p.practices.length ? p.practices.length : "None"}>
            {p.practices.length ? (
              <p>{p.practices.join(", ")} <span className="text-sm text-muted">· awaiting imagery verification</span></p>
            ) : (
              <p className="text-secondary">No practices declared. Practices like cover crops or cisterns can lower the drought score.</p>
            )}
          </Disclosure>
        </div>
      </div>
    </aside>
  );
}

// Shown before anything is selected: orient the user and say what to do next.
export function PanelWelcome({ summary, tenantName }: { summary?: PortfolioSummary; tenantName?: string }) {
  return (
    <aside className="panel panel__welcome" aria-label="Getting started">
      <Landscape height={170} />
      <div className="panel__welcome-text stack-4">
        <div className="stack-1">
          <Eyebrow>{tenantName}</Eyebrow>
          <h2>Check a property before you lend</h2>
        </div>
        {summary && (
          <p className="text-secondary">
            {summary.properties} properties in Canguçu. <strong>{summary.blockedCount} blocked</strong> and{" "}
            {Math.round(summary.flaggedPct * summary.properties) - summary.blockedCount} need a closer look.
          </p>
        )}
        <ul className="tips">
          <li><MousePointerClick size={16} aria-hidden /><span>Pick a property on the map or in the list to see its compliance verdict and climate risk.</span></li>
          <li><Search size={16} aria-hidden /><span>Press <Kbd>/</Kbd> to search by name or CAR code.</span></li>
          <li><SlidersHorizontal size={16} aria-hidden /><span>Switch the map between climate risk and compliance.</span></li>
        </ul>
      </div>
    </aside>
  );
}
