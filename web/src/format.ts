import type { FlagType, RuralProperty, Severity } from "./api/types";

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const flagLabel: Record<FlagType, string> = {
  indigenous_land: "Indigenous land",
  quilombola_territory: "Quilombola territory",
  protected_area: "Protected area",
  embargo: "Embargo",
  deforestation: "Deforestation",
  car_overlap: "CAR overlap",
  car_status: "CAR status",
  lista_suja: "Lista suja",
};

export function worstSeverity(p: RuralProperty): Severity | "ok" {
  if (p.flags.some((f) => f.severity === "block")) return "block";
  if (p.flags.some((f) => f.severity === "warn")) return "warn";
  return "ok";
}

export const severityText = { block: "Blocked", warn: "Review", ok: "Clear", info: "Info" } as const;
