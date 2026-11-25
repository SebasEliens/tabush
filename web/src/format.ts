import type { TenureFlag } from "./api/publicLayers";
import type { FlagType, RuralProperty, Severity } from "./api/types";
import type { Tone } from "./ui";

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const brlCompact = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const dateLong = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const flagLabel: Record<FlagType, string> = {
  indigenous_land: "Indigenous land",
  quilombola_territory: "Quilombola territory",
  protected_area: "Protected area",
  embargo: "Environmental embargo",
  deforestation: "Recent deforestation",
  car_overlap: "Overlapping CAR",
  car_status: "CAR status",
  lista_suja: "Slave-labour list",
};

export type Status = Severity | "ok";

export function worstSeverity(p: RuralProperty): Status {
  if (p.flags.some((f) => f.severity === "block")) return "block";
  if (p.flags.some((f) => f.severity === "warn")) return "warn";
  return "ok";
}

export const statusTone: Record<Status, Tone> = { block: "danger", warn: "warning", ok: "success", info: "info" };
export const statusText: Record<Status, string> = { block: "Blocked", warn: "Review", ok: "Clear", info: "Note" };

// Plain-language verdicts: say what it means for the credit officer's decision.
export const verdict: Record<Exclude<Status, "info">, { title: string; body: string }> = {
  block: { title: "Not eligible for rural credit", body: "At least one finding blocks credit under Central Bank rules until it is resolved." },
  warn: { title: "Needs a closer look", body: "Nothing blocks credit, but these findings should be checked before approval." },
  ok: { title: "No compliance issues found", body: "Checked against territories, embargoes, deforestation and the CAR registry." },
};

// Public land-tenure layers (CAR records, protected areas). Plain words for
// the codes SICAR and CNUC publish.
export const tenureFlagText: Record<TenureFlag, string> = {
  indigenous_land: "Overlaps an indigenous land",
  public_protected_area: "Overlaps a protected area that must be public land",
  car_overlap: "Overlaps another CAR claim",
  none: "No overlap found",
  not_assessed: "Not assessed",
};
export const carTypeText: Record<string, string> = {
  IRU: "Private rural property",
  AST: "Agrarian reform settlement",
  PCT: "Traditional community territory",
};
export const carStatusText: Record<string, string> = {
  AT: "Active",
  PE: "Pending",
  SU: "Suspended",
  CA: "Cancelled",
};
export const sizeClassText: Record<string, string> = {
  small: "Small property, family-farm size (up to 4 fiscal modules)",
  medium: "Medium property (4 to 15 fiscal modules)",
  large: "Large property (over 15 fiscal modules)",
};
export const hectares = (n: number) => `${Number(n).toLocaleString("en-GB", { maximumFractionDigits: Number(n) < 10 ? 1 : 0 })} ha`;
