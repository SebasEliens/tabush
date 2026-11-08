import type { PortfolioSummary, TabushApi } from "../types";
import { alerts, properties, tenantOwns, tenants, territories } from "./data";

const delay = <T,>(v: T, ms = 150) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const owned = (tenantId: string) => properties.filter((p) => tenantOwns(tenantId, p.carCode));

export const mockApi: TabushApi = {
  listTenants: () => delay(tenants),
  listProperties: (t) => delay(owned(t)),
  getProperty: (t, car) => delay(owned(t).find((p) => p.carCode === car)),
  listTerritories: () => delay(territories),
  listAlerts: (t) => delay(alerts.filter((a) => tenantOwns(t, a.carCode))),
  portfolioSummary: (t) => {
    const ps = owned(t);
    const flagged = ps.filter((p) => p.flags.some((f) => f.severity !== "info"));
    const buckets = [
      { label: "Low (<0.35)", test: (x: number) => x < 0.35 },
      { label: "Medium (0.35–0.6)", test: (x: number) => x >= 0.35 && x <= 0.6 },
      { label: "High (>0.6)", test: (x: number) => x > 0.6 },
    ];
    const s: PortfolioSummary = {
      properties: ps.length,
      exposureBrl: ps.reduce((a, p) => a + p.loans.reduce((b, l) => b + l.amountBrl, 0), 0),
      flaggedPct: ps.length ? flagged.length / ps.length : 0,
      blockedCount: ps.filter((p) => p.flags.some((f) => f.severity === "block")).length,
      meanRisk: ps.reduce((a, p) => a + p.risk.overall, 0) / Math.max(1, ps.length),
      riskBuckets: buckets.map((b) => ({ label: b.label, count: ps.filter((p) => b.test(p.risk.overall)).length })),
    };
    return delay(s);
  },
};
