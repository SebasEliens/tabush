// Shapes mirror the planned REST API (POST /checks, GET /risk/{property},
// POST /portfolio/score) and the rural-property ontology.

export type Polygon = GeoJSON.Polygon;

export interface Tenant {
  id: string;
  name: string;
  kind: "credit_coop" | "bank" | "insurer";
}

export type CarStatus = "active" | "pending" | "suspended" | "cancelled";

export type FlagType =
  | "indigenous_land"
  | "quilombola_territory"
  | "protected_area"
  | "embargo"
  | "deforestation"
  | "car_overlap"
  | "car_status"
  | "lista_suja";

export type Severity = "block" | "warn" | "info";

export interface ComplianceFlag {
  type: FlagType;
  severity: Severity;
  detail: string;
  source: string;
  snapshotDate: string;
  overlapHa?: number;
}

export interface HazardScores {
  drought: number; // 0..1
  flood: number;
  heat: number;
  overall: number;
  expectedYieldLossPct: number;
  zarcClass: "low" | "medium" | "high";
}

export interface Loan {
  id: string;
  product: string;
  amountBrl: number;
  maturity: string;
}

export interface RuralProperty {
  carCode: string;
  name: string;
  municipality: string;
  ibgeCode: string;
  areaHa: number;
  mainCrop: string;
  carStatus: CarStatus;
  holderHash: string;
  geometry: Polygon;
  flags: ComplianceFlag[];
  risk: HazardScores;
  loans: Loan[];
  practices: string[];
}

export interface Territory {
  id: string;
  name: string;
  kind: "indigenous_land" | "quilombola_territory" | "protected_area";
  source: string;
  geometry: Polygon;
}

export interface Alert {
  id: string;
  date: string;
  kind: "deforestation" | "embargo" | "drought_trigger" | "flood_event" | "car_status";
  carCode: string;
  title: string;
  source: string;
}

export interface PortfolioSummary {
  properties: number;
  exposureBrl: number;
  flaggedPct: number;
  blockedCount: number;
  meanRisk: number;
  riskBuckets: { label: string; count: number }[];
}

export interface TabushApi {
  listTenants(): Promise<Tenant[]>;
  listProperties(tenantId: string): Promise<RuralProperty[]>;
  getProperty(tenantId: string, carCode: string): Promise<RuralProperty | undefined>;
  listTerritories(): Promise<Territory[]>;
  listAlerts(tenantId: string): Promise<Alert[]>;
  portfolioSummary(tenantId: string): Promise<PortfolioSummary>;
}
