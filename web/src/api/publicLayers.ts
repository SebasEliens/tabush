import { config } from "../config";

// Public reference layers (shared by every tenant) are served as static
// PMTiles next to a small JSON with their provenance, written by the Python
// ingest (src/tabush/ingest/). They don't go through the tenant API.

export type PublicLayerId = "protected_areas" | "indigenous_lands" | "rural_properties";

/** Drawn bottom to top, all under the tenant's own parcels. */
export const PUBLIC_LAYER_STACK: PublicLayerId[] = ["protected_areas", "indigenous_lands", "rural_properties"];

export type TenureFlag = "indigenous_land" | "public_protected_area" | "car_overlap" | "none" | "not_assessed";

export interface PublicLayerMeta {
  layer: PublicLayerId;
  source: string;
  snapshot_date: string;
  features: number;
  /** rural_properties only: pilot municipalities and their lon/lat bounds. */
  municipalities?: { name: string; bbox: [number, number, number, number] }[];
  /** rural_properties only: number of records per tenure flag. */
  flags?: Partial<Record<TenureFlag, number>>;
  /** rural_properties only: the territory layers overlaps were measured against. */
  compared_with?: Partial<Record<PublicLayerId, string>>;
}

export function tilesUrl(file: string): string {
  return new URL(`${config.tilesUrl.replace(/\/$/, "")}/${file}`, window.location.href).toString();
}

/** Provenance for a layer, or undefined when its tiles haven't been built yet. */
export async function fetchLayerMeta(layer: PublicLayerId): Promise<PublicLayerMeta | undefined> {
  try {
    const res = await fetch(tilesUrl(`${layer}.json`));
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return undefined;
    return (await res.json()) as PublicLayerMeta;
  } catch {
    return undefined;
  }
}
