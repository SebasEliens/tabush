import { config } from "../config";

// Public reference layers (shared by every tenant) are served as static
// PMTiles next to a small JSON with their provenance, written by the Python
// ingest (src/tabush/ingest/). They don't go through the tenant API.

export interface PublicLayerMeta {
  layer: string;
  source: string;
  snapshot_date: string;
  features: number;
}

export function tilesUrl(file: string): string {
  return new URL(`${config.tilesUrl.replace(/\/$/, "")}/${file}`, window.location.href).toString();
}

/** Provenance for a layer, or undefined when its tiles haven't been built yet. */
export async function fetchLayerMeta(layer: string): Promise<PublicLayerMeta | undefined> {
  try {
    const res = await fetch(tilesUrl(`${layer}.json`));
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return undefined;
    return (await res.json()) as PublicLayerMeta;
  } catch {
    return undefined;
  }
}
