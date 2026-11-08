// Living design-system reference at /design. Shows tokens and components as
// they actually render, so reviews happen against the real thing.
import { useState } from "react";
import { Download, Leaf, Plus, ShieldCheck, Thermometer, Trash2 } from "lucide-react";
import { Badge, Button, Callout, Card, Disclosure, EmptyState, Kbd, Meter, SearchInput, SegmentedControl, Stat, StatusBadge } from "../ui";
import { Landscape } from "../ui/Landscape";
import { Logo } from "../ui/Logo";

const palettes: { name: string; vars: string[] }[] = [
  { name: "Green (brand)", vars: ["green-50", "green-100", "green-200", "green-300", "green-400", "green-500", "green-600", "green-700", "green-800", "green-900", "green-950"] },
  { name: "Cyan (sky, highlight)", vars: ["cyan-50", "cyan-100", "cyan-200", "cyan-300", "cyan-400", "cyan-500", "cyan-600", "cyan-700", "cyan-800"] },
  { name: "Orange (spark)", vars: ["orange-50", "orange-200", "orange-400", "orange-500", "orange-700"] },
  { name: "Neutral", vars: ["neutral-0", "neutral-50", "neutral-100", "neutral-200", "neutral-300", "neutral-400", "neutral-500", "neutral-600", "neutral-700", "neutral-800", "neutral-900"] },
  { name: "Climate-risk ramp", vars: ["risk-1", "risk-2", "risk-3", "risk-4", "risk-5"] },
];

const typeScale = [
  ["Display / page title", "var(--font-display)", "var(--text-2xl)", 700, "Climate risk for family farms"],
  ["Section title", "var(--font-sans)", "var(--text-xl)", 600, "Needs attention"],
  ["Panel title", "var(--font-sans)", "var(--text-lg)", 600, "Climate risk"],
  ["Body", "var(--font-sans)", "var(--text-md)", 400, "Overlaps the quilombola territory by about 4 ha."],
  ["Secondary", "var(--font-sans)", "var(--text-sm)", 400, "Source: INCRA · snapshot 2026-11-01"],
  ["Caption", "var(--font-sans)", "var(--text-xs)", 500, "HIGHEST RISK FIRST"],
] as const;

export function DesignPage() {
  const [seg, setSeg] = useState<"risk" | "compliance">("risk");
  const [q, setQ] = useState("");
  return (
    <div className="page">
      <div className="hero">
        <Landscape height={220} />
        <div className="hero__text">
          <h1>Tabush design system</h1>
          <p>Tokens and components, rendered live. Source: web/src/design and web/src/ui.</p>
        </div>
      </div>

      <Card title="Principles" description="Human-centred design applied to every screen. Full text in docs/design-system.md.">
        <ol className="stack-2" style={{ margin: 0, paddingLeft: "var(--space-5)" }}>
          <li><strong>Start from the decision.</strong> Each screen answers the credit officer's question first, then shows evidence.</li>
          <li><strong>Plain language over scores.</strong> Every number has a word (High, Blocked) and every status has an icon, never colour alone.</li>
          <li><strong>Progressive disclosure.</strong> Summary up top, details and sources one click away.</li>
          <li><strong>Traceable.</strong> Every finding shows its source and snapshot date.</li>
          <li><strong>Calm by default.</strong> Neutral surfaces; colour is reserved for meaning and brand moments.</li>
        </ol>
      </Card>

      <Card title="Colour">
        <div className="stack-4">
          {palettes.map((p) => (
            <div key={p.name} className="stack-2">
              <h3>{p.name}</h3>
              <div className="swatches">
                {p.vars.map((v) => (
                  <div className="swatch" key={v}>
                    <div className="swatch__color" style={{ background: `var(--${v})` }} />
                    <div className="swatch__label mono">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Typography" description="Outfit for display moments, Inter for everything you read or scan.">
        {typeScale.map(([name, font, size, weight, sample]) => (
          <div className="type-row" key={name}>
            <span className="text-sm text-secondary">{name}</span>
            <span style={{ fontFamily: font, fontSize: size, fontWeight: weight }}>{sample}</span>
          </div>
        ))}
        <div className="type-row"><span className="text-sm text-secondary">Brand</span><Logo /></div>
      </Card>

      <Card title="Buttons">
        <div className="gallery-row">
          <Button variant="primary" icon={Plus}>Primary</Button>
          <Button variant="secondary" icon={Download}>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={Trash2}>Danger</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button iconOnly icon={Leaf} aria-label="Icon button" />
        </div>
      </Card>

      <div className="two-col">
        <Card title="Status">
          <div className="stack-3">
            <div className="gallery-row">
              <StatusBadge tone="danger">Blocked</StatusBadge>
              <StatusBadge tone="warning">Review</StatusBadge>
              <StatusBadge tone="success">Clear</StatusBadge>
              <StatusBadge tone="info">Note</StatusBadge>
              <Badge>Neutral</Badge>
              <Badge tone="accent">Accent</Badge>
              <Badge tone="mock">Mock data</Badge>
            </div>
            <Callout tone="danger" title="Not eligible for rural credit">CAR registration is suspended.</Callout>
            <Callout tone="warning" title="Needs a closer look">Native vegetation loss of 1.4 ha after 2019.</Callout>
            <Callout tone="success" title="No compliance issues found" />
          </div>
        </Card>
        <Card title="Inputs and data">
          <div className="stack-4">
            <SearchInput label="Search" placeholder="Search name or CAR code" value={q} onChange={setQ} />
            <SegmentedControl label="Colour by" value={seg} onChange={setSeg} options={[{ value: "risk", label: "Climate risk", icon: Thermometer }, { value: "compliance", label: "Compliance", icon: ShieldCheck }]} />
            <div className="stack-2">
              <Meter label="Drought" value={0.82} />
              <Meter label="Flood" value={0.48} />
              <Meter label="Heat" value={0.21} />
            </div>
            <p className="text-sm">Keyboard hint: press <Kbd>/</Kbd> to search.</p>
          </div>
        </Card>
      </div>

      <div className="two-col">
        <Stat label="Credit exposure" value="R$ 6,9 mi" hint="R$ 6.945.000" />
        <Stat label="Blocked" value="11" tone="danger" hint="24% flagged in total" />
      </div>

      <div className="two-col">
        <Card title="Disclosure">
          <Disclosure title="All checks and sources" meta="3 findings" defaultOpen>Details live here, one click away.</Disclosure>
          <Disclosure title="Loans" meta="R$ 181.000">Hidden until needed.</Disclosure>
        </Card>
        <Card title="Empty state">
          <EmptyState icon={Leaf} title="No matching properties">Say what happened and what to try next.</EmptyState>
        </Card>
      </div>
    </div>
  );
}
