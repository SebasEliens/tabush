// Deterministic fake data around Canguçu (RS), the municipality with the most
// family farms in Brazil. Geometries, names, people and loans are all made up.
import type {
  Alert,
  ComplianceFlag,
  HazardScores,
  Loan,
  Polygon,
  RuralProperty,
  Tenant,
  Territory,
} from "../types";

const CENTER: [number, number] = [-52.675, -31.395];
const SNAPSHOT = "2026-11-01";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export const tenants: Tenant[] = [
  { id: "coop-sul", name: "Cooperativa Sul (pilot)", kind: "credit_coop" },
  { id: "banco-exemplo", name: "Banco Exemplo", kind: "bank" },
];

function ring(coords: [number, number][]): Polygon {
  return { type: "Polygon", coordinates: [[...coords, coords[0]]] };
}

export const territories: Territory[] = [
  {
    id: "qt-1",
    name: "Quilombola territory (mock)",
    kind: "quilombola_territory",
    source: "INCRA",
    geometry: ring([
      [-52.712, -31.37],
      [-52.69, -31.366],
      [-52.684, -31.384],
      [-52.703, -31.392],
      [-52.716, -31.383],
    ]),
  },
  {
    id: "pa-1",
    name: "State conservation unit (mock)",
    kind: "protected_area",
    source: "ICMBio / CNUC",
    geometry: ring([
      [-52.64, -31.41],
      [-52.622, -31.408],
      [-52.618, -31.43],
      [-52.638, -31.434],
    ]),
  },
];

function pointInPolygon([x, y]: number[], poly: Polygon): boolean {
  const r = poly.coordinates[0];
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function areaHa(poly: Polygon): number {
  const r = poly.coordinates[0];
  const mPerDegLat = 110_574;
  const mPerDegLon = 111_320 * Math.cos((CENTER[1] * Math.PI) / 180);
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) {
    s += r[i][0] * mPerDegLon * r[i + 1][1] * mPerDegLat - r[i + 1][0] * mPerDegLon * r[i][1] * mPerDegLat;
  }
  return Math.abs(s / 2) / 10_000;
}

const CROPS = ["Tobacco", "Soy", "Maize", "Beans", "Dairy pasture", "Peach orchard"];
const PRACTICES = ["Cover crops", "Agroforestry", "Drip irrigation", "No-till", "Rainwater cistern"];
const FIRST = ["Sítio", "Chácara", "Fazenda", "Granja"];
const SECOND = ["Boa Vista", "São João", "Santa Rita", "Pinheiros", "Recanto", "Bela Vista", "Esperança", "Três Irmãos", "Coxilha", "Arroio Grande", "Primavera", "Santo Antônio", "Cerro Alto", "Capão Seco", "Bom Jesus", "Pitangueira", "Sanga Funda", "Palmeiras", "Nova Aliança", "Butiá", "Figueira", "Lagoa Bonita", "São Pedro", "Pessegueiro", "Vertentes"];

function makeFlags(geom: Polygon, idx: number, area: number): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  const verts = geom.coordinates[0].slice(0, -1);
  for (const t of territories) {
    const inside = verts.filter((v) => pointInPolygon(v, t.geometry)).length;
    if (inside > 0) {
      const overlapHa = round((area * inside) / verts.length, 1);
      flags.push({
        type: t.kind,
        severity: inside >= 2 ? "block" : "warn",
        detail: `Overlaps ${t.name} by ~${overlapHa} ha`,
        source: t.source,
        snapshotDate: SNAPSHOT,
        overlapHa,
      });
    }
  }
  if (idx % 17 === 5) {
    flags.push({
      type: "embargo",
      severity: "block",
      detail: "IBAMA embargo on 3.2 ha (illegal clearing, 2024)",
      source: "IBAMA",
      snapshotDate: SNAPSHOT,
    });
  }
  if (idx % 11 === 3) {
    flags.push({
      type: "deforestation",
      severity: "warn",
      detail: "Native vegetation loss of 1.4 ha detected after 2019",
      source: "MapBiomas Alerta",
      snapshotDate: SNAPSHOT,
    });
  }
  if (idx % 13 === 7) {
    flags.push({
      type: "car_overlap",
      severity: "info",
      detail: "CAR boundary overlaps a neighbouring CAR by 18%",
      source: "SICAR",
      snapshotDate: SNAPSHOT,
    });
  }
  return flags;
}

function carStatusFlag(status: RuralProperty["carStatus"]): ComplianceFlag[] {
  if (status === "suspended")
    return [{ type: "car_status", severity: "block", detail: "CAR registration is suspended", source: "SICAR", snapshotDate: SNAPSHOT }];
  if (status === "pending")
    return [{ type: "car_status", severity: "info", detail: "CAR analysis by the state agency is still pending", source: "SICAR", snapshotDate: SNAPSHOT }];
  return [];
}

function makeRisk(lon: number, lat: number): HazardScores {
  // Drought rises to the north-west, flood risk sits along a mock river valley.
  const drought = Math.min(1, Math.max(0, 0.35 + (CENTER[0] - lon) * 9 + (lat - CENTER[1]) * 8 + (rand() - 0.5) * 0.25));
  const flood = Math.min(1, Math.max(0, 0.8 - Math.abs(lat - (CENTER[1] - 0.018)) * 16 + (rand() - 0.5) * 0.2));
  const heat = Math.min(1, Math.max(0, 0.3 + rand() * 0.3));
  const overall = round(0.5 * drought + 0.3 * flood + 0.2 * heat);
  return {
    drought: round(drought),
    flood: round(flood),
    heat: round(heat),
    overall,
    expectedYieldLossPct: round(overall * 28, 1),
    zarcClass: overall > 0.6 ? "high" : overall > 0.35 ? "medium" : "low",
  };
}

function makeLoans(idx: number): Loan[] {
  const n = idx % 4 === 0 ? 2 : 1;
  return Array.from({ length: n }, (_, k) => ({
    id: `LN-${2026}${String(idx * 3 + k).padStart(4, "0")}`,
    product: pick(["Pronaf Custeio", "Pronaf Investimento", "Pronaf Mais Alimentos", "Pronaf ABC+"]),
    amountBrl: Math.round((20_000 + rand() * 180_000) / 1000) * 1000,
    maturity: `20${27 + (k % 3)}-0${1 + Math.floor(rand() * 9)}-15`,
  }));
}

function buildProperties(): RuralProperty[] {
  const out: RuralProperty[] = [];
  const cols = 10;
  const rows = 8;
  const dx = 0.011;
  const dy = 0.0095;
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = CENTER[0] - (cols / 2) * dx + c * dx;
      const y0 = CENTER[1] + (rows / 2) * dy - r * dy;
      // Leave gaps, and keep the urban core of Canguçu free of farms.
      const nearTown = Math.hypot(x0 + dx / 2 - (CENTER[0] + 0.005), y0 - dy / 2 - (CENTER[1] + 0.005)) < 0.014;
      if (rand() < 0.15 || nearTown) continue;
      const j = () => (rand() - 0.5) * dx * 0.25;
      const shrink = 0.08 + rand() * 0.12;
      const geom = ring([
        [x0 + dx * shrink + j(), y0 - dy * shrink + j()],
        [x0 + dx * (1 - shrink) + j(), y0 - dy * shrink + j()],
        [x0 + dx * (1 - shrink) + j(), y0 - dy * (1 - shrink) + j()],
        [x0 + dx * shrink + j(), y0 - dy * (1 - shrink) + j()],
      ]);
      const area = round(areaHa(geom), 1);
      const cx = x0 + dx / 2;
      const cy = y0 - dy / 2;
      const carStatus: RuralProperty["carStatus"] = idx % 19 === 4 ? "suspended" : idx % 7 === 2 ? "pending" : "active";
      const flags = [...carStatusFlag(carStatus), ...makeFlags(geom, idx, area)];
      out.push({
        carCode: `RS-4304507-${(0xa1b2c3 + idx * 7919).toString(16).toUpperCase().padStart(6, "0")}${String(idx).padStart(4, "0")}`,
        name: `${pick(FIRST)} ${pick(SECOND)}`,
        municipality: "Canguçu",
        ibgeCode: "4304507",
        areaHa: area,
        mainCrop: pick(CROPS),
        carStatus,
        holderHash: `sha256:${Math.floor(rand() * 0xffffffff).toString(16).padStart(8, "0")}…`,
        geometry: geom,
        flags,
        risk: makeRisk(cx, cy),
        loans: makeLoans(idx),
        practices: rand() < 0.4 ? [pick(PRACTICES)] : [],
      });
      idx++;
    }
  }
  return out;
}

export const properties: RuralProperty[] = buildProperties();

export function tenantOwns(tenantId: string, carCode: string): boolean {
  const i = properties.findIndex((p) => p.carCode === carCode);
  return tenantId === "coop-sul" ? i % 3 !== 2 : i % 2 === 0;
}

export const alerts: Alert[] = properties
  .flatMap((p, i): Alert[] => {
    const a: Alert[] = [];
    if (p.flags.some((f) => f.type === "deforestation"))
      a.push({ id: `al-d-${i}`, date: `2026-10-${String(10 + (i % 18)).padStart(2, "0")}`, kind: "deforestation", carCode: p.carCode, title: `New vegetation loss on ${p.name}`, source: "MapBiomas Alerta / DETER" });
    if (p.flags.some((f) => f.type === "embargo"))
      a.push({ id: `al-e-${i}`, date: `2026-09-${String(5 + (i % 20)).padStart(2, "0")}`, kind: "embargo", carCode: p.carCode, title: `IBAMA embargo published for ${p.name}`, source: "IBAMA" });
    if (p.risk.drought > 0.75)
      a.push({ id: `al-t-${i}`, date: "2026-11-03", kind: "drought_trigger", carCode: p.carCode, title: `Drought index (SPI-3 = ${(-1.2 - p.risk.drought * 0.6).toFixed(2)}) crossed the payout trigger for ${p.name}`, source: "CHIRPS · index v1.2" });
    if (p.risk.flood > 0.75)
      a.push({ id: `al-f-${i}`, date: "2026-10-21", kind: "flood_event", carCode: p.carCode, title: `Sentinel-1 shows standing water on ${p.name}`, source: "Sentinel-1 water extent" });
    if (p.carStatus === "suspended")
      a.push({ id: `al-c-${i}`, date: "2026-10-02", kind: "car_status", carCode: p.carCode, title: `CAR suspended for ${p.name}`, source: "SICAR" });
    return a;
  })
  .sort((a, b) => b.date.localeCompare(a.date));
