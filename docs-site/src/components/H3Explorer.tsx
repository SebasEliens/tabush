import { cellArea, cellToBoundary, getHexagonAreaAvg, latLngToCell, polygonToCells } from "h3-js";
import { useMemo, useState } from "react";

// A synthetic, irregular farm outline near Canguçu (RS), scaled to a target
// area. It is not a real CAR record: the point is how H3 cells of each
// resolution fit a parcel of a given size.
const CENTRE = { lat: -31.395, lng: -52.676 };
const SHAPE: [number, number][] = [
  [0, 0], [1.0, 0.08], [1.18, 0.55], [0.95, 1.02], [0.42, 1.12], [0.05, 0.78], [-0.08, 0.35],
];
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((CENTRE.lat * Math.PI) / 180);

function shoelace(pts: [number, number][]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Farm outline as [lat, lng] for a target area in hectares. */
function farm(hectares: number): [number, number][] {
  const unitArea = shoelace(SHAPE); // in "shape units" squared
  const side = Math.sqrt((hectares * 10_000) / unitArea); // metres per shape unit
  return SHAPE.map(([x, y]) => [CENTRE.lat + (y * side) / M_PER_DEG_LAT, CENTRE.lng + (x * side) / M_PER_DEG_LNG]);
}

const FARMS = [
  { id: "plot", label: "Small family plot", ha: 6 },
  { id: "family", label: "Family farm", ha: 25 },
  { id: "medium", label: "Medium property", ha: 250 },
];
const RESOLUTIONS = [7, 8, 9, 10];

export default function H3Explorer() {
  const [res, setRes] = useState(9);
  const [farmId, setFarmId] = useState("family");
  const target = FARMS.find((f) => f.id === farmId)!;

  const view = useMemo(() => {
    const outline = farm(target.ha);
    let cells = polygonToCells(outline, res);
    const fallback = cells.length === 0;
    if (fallback) {
      const lat = outline.reduce((s, p) => s + p[0], 0) / outline.length;
      const lng = outline.reduce((s, p) => s + p[1], 0) / outline.length;
      cells = [latLngToCell(lat, lng, res)];
    }
    const cellHa = cells.reduce((s, c) => s + cellArea(c, "m2"), 0) / 10_000;
    const hexes = cells.map((c) => cellToBoundary(c));
    // Fit the drawing to the farm and its cells.
    const all = [...outline, ...hexes.flat()];
    const xs = all.map((p) => (p[1] - CENTRE.lng) * M_PER_DEG_LNG);
    const ys = all.map((p) => (p[0] - CENTRE.lat) * M_PER_DEG_LAT);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY) * 1.1;
    const toSvg = ([lat, lng]: [number, number] | number[]) => {
      const x = ((lng - CENTRE.lng) * M_PER_DEG_LNG - (minX + maxX) / 2) / span;
      const y = ((lat - CENTRE.lat) * M_PER_DEG_LAT - (minY + maxY) / 2) / span;
      return `${(0.5 + x) * 100},${(0.5 - y) * 100}`;
    };
    return {
      outline: outline.map(toSvg).join(" "),
      hexes: hexes.map((h) => h.map(toSvg).join(" ")),
      count: cells.length,
      fallback,
      cellHa,
      error: Math.round(((cellHa - target.ha) / target.ha) * 100),
      avgHa: getHexagonAreaAvg(res, "km2") * 100,
    };
  }, [res, target]);

  return (
    <div className="tb-widget not-content" data-testid="h3-explorer">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "end", marginBottom: "1rem" }}>
        <label style={{ flex: "1 1 14rem" }}>
          <span style={{ display: "flex", justifyContent: "space-between" }}>
            <span>H3 resolution</span>
            <output data-testid="h3-res">{res}</output>
          </span>
          <input
            type="range"
            min={RESOLUTIONS[0]}
            max={RESOLUTIONS.at(-1)}
            value={res}
            onChange={(e) => setRes(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--sl-color-accent)" }}
          />
        </label>
        <label>
          <span style={{ display: "block" }}>Parcel</span>
          <select value={farmId} onChange={(e) => setFarmId(e.target.value)}>
            {FARMS.map((f) => (
              <option key={f.id} value={f.id}>{f.label} (~{f.ha} ha)</option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))", alignItems: "center" }}>
        <svg viewBox="0 0 100 100" role="img" aria-label={`Parcel of about ${target.ha} hectares covered by ${view.count} H3 cells at resolution ${res}`} style={{ width: "100%", maxWidth: "22rem", background: "var(--sl-color-gray-7, transparent)", borderRadius: "0.5rem" }}>
          {view.hexes.map((h, i) => (
            <polygon key={i} points={h} fill="var(--cyan-300)" fillOpacity={0.35} stroke="var(--cyan-700)" strokeWidth={0.4} />
          ))}
          <polygon points={view.outline} fill="none" stroke="var(--green-600)" strokeWidth={0.9} strokeLinejoin="round" />
        </svg>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.35rem 1rem" }}>
          <dt>Average cell</dt>
          <dd style={{ margin: 0 }}>{view.avgHa < 10 ? view.avgHa.toFixed(1) : Math.round(view.avgHa)} ha</dd>
          <dt>Cells for this parcel</dt>
          <dd style={{ margin: 0 }} data-testid="h3-count">{view.count}{view.fallback && " (centroid fallback)"}</dd>
          <dt>Area the cells claim</dt>
          <dd style={{ margin: 0 }}>{view.cellHa.toFixed(1)} ha ({view.error > 0 ? "+" : ""}{view.error}% vs parcel)</dd>
        </dl>
      </div>
      <p className="tb-muted" style={{ marginTop: "0.75rem" }}>
        {view.fallback
          ? "No cell centre falls inside the parcel, so it is indexed by the one cell under its centroid. Joins at this resolution blur the parcel into its neighbours."
          : view.count > 400
            ? "Hundreds of cells per parcel: precise, but every join and graph node multiplies."
            : "Cells whose centre falls inside the parcel (h3-js polygonToCells). Green line: synthetic parcel outline, not a real CAR record."}
      </p>
    </div>
  );
}
