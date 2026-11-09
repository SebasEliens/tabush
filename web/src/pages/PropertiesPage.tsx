import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Leaf, ShieldCheck, Thermometer } from "lucide-react";
import { api } from "../api/client";
import type { PortfolioSummary, RuralProperty, Territory } from "../api/types";
import { MapView, type ColorBy } from "../components/MapView";
import { PanelWelcome, PropertyPanel } from "../components/PropertyPanel";
import { riskRamp } from "../design/tokens";
import { statusText, statusTone, worstSeverity } from "../format";
import { useTenant } from "../tenant";
import { EmptyState, SearchInput, SegmentedControl, Skeleton, StatusBadge, riskLevel } from "../ui";

export function PropertiesPage() {
  const { tenant } = useTenant();
  const [props, setProps] = useState<RuralProperty[]>();
  const [summary, setSummary] = useState<PortfolioSummary>();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [query, setQuery] = useState("");
  const [colorBy, setColorBy] = useState<ColorBy>("risk");
  const [params, setParams] = useSearchParams();
  const selected = params.get("car") ?? undefined;
  const setSelected = (car?: string) => setParams(car ? { car } : {});

  useEffect(() => {
    api.listTerritories().then(setTerritories);
  }, []);
  useEffect(() => {
    if (!tenant) return;
    setProps(undefined);
    api.listProperties(tenant.id).then(setProps);
    api.portfolioSummary(tenant.id).then(setSummary);
  }, [tenant]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (props ?? [])
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.carCode.toLowerCase().includes(q))
      .sort((a, b) => b.risk.overall - a.risk.overall);
  }, [props, query]);
  const current = props?.find((p) => p.carCode === selected);

  return (
    <div className="workspace">
      <aside className="sidebar" aria-label="Properties">
        <div className="sidebar__head stack-2">
          <SearchInput label="Search properties" placeholder="Search name or CAR code" value={query} onChange={setQuery} />
          <div className="text-xs text-muted">
            {props ? `${filtered.length} of ${props.length} properties · highest risk first` : "Loading properties…"}
          </div>
        </div>
        <ul className="sidebar__list">
          {!props &&
            Array.from({ length: 8 }, (_, i) => (
              <li key={i} style={{ padding: "var(--space-3)" }} className="stack-2"><Skeleton width="60%" /><Skeleton width="40%" height={10} /></li>
            ))}
          {props && filtered.length === 0 && (
            <EmptyState icon={Leaf} title="No matching properties">Try part of the name, or the last digits of the CAR code.</EmptyState>
          )}
          {filtered.map((p) => {
            const s = worstSeverity(p);
            const lvl = riskLevel(p.risk.overall);
            return (
              <li key={p.carCode}>
                <button className="prop-item" aria-current={p.carCode === selected} onClick={() => setSelected(p.carCode)}>
                  <div className="row-between">
                    <span className="prop-item__name">{p.name}</span>
                    <StatusBadge tone={statusTone[s]}>{statusText[s]}</StatusBadge>
                  </div>
                  <div className="row-between prop-item__meta">
                    <span>{p.areaHa} ha · {p.mainCrop}</span>
                    <span className="risk-chip"><i style={{ background: lvl.color }} />{lvl.label} {p.risk.overall.toFixed(2)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="map-area">
        <MapView properties={props ?? []} territories={territories} selected={selected} colorBy={colorBy} onSelect={setSelected} />
        <div className="map-overlay">
          <SegmentedControl
            label="Colour properties by"
            value={colorBy}
            onChange={setColorBy}
            options={[
              { value: "risk", label: "Climate risk", icon: Thermometer },
              { value: "compliance", label: "Compliance", icon: ShieldCheck },
            ]}
          />
          <div className="map-card legend">
            {colorBy === "risk" ? (
              <>
                <strong>Overall climate risk</strong>
                <div className="legend__ramp">{riskRamp.map((c) => <span key={c} style={{ background: c }} />)}</div>
                <div className="row-between"><span>Low</span><span>High</span></div>
              </>
            ) : (
              <>
                <strong>Compliance verdict</strong>
                <div><span className="legend__swatch" style={{ background: "var(--color-success)" }} />Clear</div>
                <div><span className="legend__swatch" style={{ background: "var(--color-warning)" }} />Needs review</div>
                <div><span className="legend__swatch" style={{ background: "var(--color-danger)" }} />Blocked</div>
              </>
            )}
            <div><span className="legend__swatch legend__swatch--territory" />Protected or traditional territory</div>
          </div>
        </div>
      </div>

      {current ? <PropertyPanel p={current} onClose={() => setSelected(undefined)} /> : <PanelWelcome summary={summary} tenantName={tenant?.name} />}
    </div>
  );
}
