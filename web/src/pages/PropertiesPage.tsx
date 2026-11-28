import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Leaf, ShieldCheck, Thermometer } from "lucide-react";
import { api } from "../api/client";
import { tenureDataMode, usePublicLayerMeta, type PublicLayerId, type PublicLayerMeta } from "../api/publicLayers";
import type { PortfolioSummary, RuralProperty, Territory } from "../api/types";
import { MapView, type ColorBy } from "../components/MapView";
import { PublicLayersLegend } from "../components/PublicLayersLegend";
import { PanelWelcome, PropertyPanel } from "../components/PropertyPanel";
import { riskRamp } from "../design/tokens";
import { statusText, statusTone, worstSeverity } from "../format";
import { useTenant } from "../tenant";
import { Button, EmptyState, Kbd, MapPanel, SearchInput, SegmentedControl, Skeleton, StatusBadge, riskLevel, useStoredState } from "../ui";

export function PropertiesPage() {
  const { tenant } = useTenant();
  const [props, setProps] = useState<RuralProperty[]>();
  const [summary, setSummary] = useState<PortfolioSummary>();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const layerMeta = usePublicLayerMeta();
  // The fake portfolio is a stand-in: once real land tenure data is loaded it goes away.
  const mode = tenureDataMode(layerMeta);
  const showMock = mode === "mock";
  const [panelsHidden, setPanelsHidden] = useStoredState("tabush.map.panelsHidden", false);
  const [panelOpen, setPanelOpen] = useStoredState<Record<"colours" | "tenure", boolean>>("tabush.map.panelOpen", { colours: true, tenure: true });
  const [visibleLayers, setVisibleLayers] = useState<Record<PublicLayerId, boolean>>({ protected_areas: true, indigenous_lands: true, rural_properties: true });
  const [focus, setFocus] = useState<{ bbox: [number, number, number, number] }>();
  const [query, setQuery] = useState("");
  const [colorBy, setColorBy] = useState<ColorBy>("risk");
  const [params, setParams] = useSearchParams();
  const selected = params.get("car") ?? undefined;
  const setSelected = (car?: string) => setParams(car ? { car } : {});

  useEffect(() => {
    if (showMock) api.listTerritories().then(setTerritories);
  }, [showMock]);
  useEffect(() => {
    if (!tenant || !showMock) return;
    setProps(undefined);
    api.listProperties(tenant.id).then(setProps);
    api.portfolioSummary(tenant.id).then(setSummary);
  }, [tenant, showMock]);
  // "H" hides or shows every panel on the map, wherever focus is (except while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "h" || e.metaKey || e.ctrlKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      setPanelsHidden((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPanelsHidden]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (props ?? [])
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.carCode.toLowerCase().includes(q))
      .sort((a, b) => b.risk.overall - a.risk.overall);
  }, [props, query]);
  const current = props?.find((p) => p.carCode === selected);
  const loadedLayers = useMemo(
    () => Object.fromEntries(Object.entries(layerMeta).filter(([, m]) => m)) as Partial<Record<PublicLayerId, PublicLayerMeta>>,
    [layerMeta],
  );

  return (
    <div className={showMock ? "workspace" : "workspace workspace--map-only"}>
      {showMock && <aside className="sidebar" aria-label="Properties">
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
      </aside>}

      <div className="map-area">
        <MapView
          properties={showMock ? (props ?? []) : []}
          territories={showMock ? territories : []}
          selected={selected}
          colorBy={colorBy}
          publicLayers={loadedLayers}
          visibleLayers={visibleLayers}
          focus={focus}
          onSelect={setSelected}
        />
        <div className="map-overlay">
          <Button
            size="sm"
            className="map-overlay__toggle"
            icon={panelsHidden ? Eye : EyeOff}
            aria-pressed={panelsHidden}
            onClick={() => setPanelsHidden(!panelsHidden)}
            title="Hide or show map panels (H)"
          >
            {panelsHidden ? "Show panels" : "Hide panels"}
            <Kbd>H</Kbd>
          </Button>
          {!panelsHidden && showMock && (
            <MapPanel
              className="legend"
              title={colorBy === "risk" ? "Overall climate risk" : "Compliance verdict"}
              open={panelOpen.colours}
              onOpenChange={(open) => setPanelOpen((p) => ({ ...p, colours: open }))}
            >
              <SegmentedControl
                label="Colour properties by"
                value={colorBy}
                onChange={setColorBy}
                options={[
                  { value: "risk", label: "Climate risk", icon: Thermometer },
                  { value: "compliance", label: "Compliance", icon: ShieldCheck },
                ]}
              />
              {colorBy === "risk" ? (
                <>
                  <div className="legend__ramp">{riskRamp.map((c) => <span key={c} style={{ background: c }} />)}</div>
                  <div className="row-between"><span>Low</span><span>High</span></div>
                </>
              ) : (
                <>
                  <div><span className="legend__swatch" style={{ background: "var(--color-success)" }} />Clear</div>
                  <div><span className="legend__swatch" style={{ background: "var(--color-warning)" }} />Needs review</div>
                  <div><span className="legend__swatch" style={{ background: "var(--color-danger)" }} />Blocked</div>
                </>
              )}
              <div><span className="legend__swatch legend__swatch--territory" />Protected or traditional territory</div>
            </MapPanel>
          )}
          {!panelsHidden && (
            <PublicLayersLegend
              meta={layerMeta}
              visible={visibleLayers}
              onToggle={(id, on) => setVisibleLayers((v) => ({ ...v, [id]: on }))}
              onFocus={(bbox) => setFocus({ bbox })}
              open={panelOpen.tenure}
              onOpenChange={(open) => setPanelOpen((p) => ({ ...p, tenure: open }))}
            />
          )}
        </div>
      </div>

      {showMock && (current ? <PropertyPanel p={current} onClose={() => setSelected(undefined)} /> : <PanelWelcome summary={summary} tenantName={tenant?.name} />)}
    </div>
  );
}
