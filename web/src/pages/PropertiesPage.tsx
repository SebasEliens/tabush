import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { RuralProperty, Territory } from "../api/types";
import { MapView, type ColorBy } from "../components/MapView";
import { PropertyPanel } from "../components/PropertyPanel";
import { severityText, worstSeverity } from "../format";
import { useTenant } from "../tenant";

export function PropertiesPage() {
  const { tenant } = useTenant();
  const [props, setProps] = useState<RuralProperty[]>([]);
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
    if (tenant) api.listProperties(tenant.id).then(setProps);
  }, [tenant]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.carCode.toLowerCase().includes(q))
      .sort((a, b) => b.risk.overall - a.risk.overall);
  }, [props, query]);
  const current = props.find((p) => p.carCode === selected);

  return (
    <div className={`properties-layout ${current ? "with-panel" : ""}`}>
      <aside className="list">
        <input className="search" placeholder="Search name or CAR code" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="muted small list-count">{filtered.length} properties · sorted by risk</div>
        <ul>
          {filtered.map((p) => {
            const s = worstSeverity(p);
            return (
              <li key={p.carCode} className={p.carCode === selected ? "active" : ""} onClick={() => setSelected(p.carCode)}>
                <div className="row">
                  <strong>{p.name}</strong>
                  <span className={`pill pill-${s}`}>{severityText[s]}</span>
                </div>
                <div className="row muted small">
                  <span>{p.areaHa} ha · {p.mainCrop}</span>
                  <span>risk {p.risk.overall.toFixed(2)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="map-wrap">
        <MapView properties={props} territories={territories} selected={selected} colorBy={colorBy} onSelect={setSelected} />
        <div className="map-controls">
          <div className="seg">
            <button className={colorBy === "risk" ? "on" : ""} onClick={() => setColorBy("risk")}>Climate risk</button>
            <button className={colorBy === "compliance" ? "on" : ""} onClick={() => setColorBy("compliance")}>Compliance</button>
          </div>
          {colorBy === "risk" ? (
            <div className="legend">
              <div className="ramp" />
              <div className="row small"><span>low</span><span>high</span></div>
            </div>
          ) : (
            <div className="legend small">
              <div><i style={{ background: "#2e7d5b" }} /> Clear</div>
              <div><i style={{ background: "#e6a100" }} /> Review</div>
              <div><i style={{ background: "#c62828" }} /> Blocked</div>
            </div>
          )}
          <div className="legend small"><div><i className="hatch" /> Protected / traditional territory</div></div>
        </div>
      </div>

      {current && <PropertyPanel p={current} onClose={() => setSelected(undefined)} />}
    </div>
  );
}
