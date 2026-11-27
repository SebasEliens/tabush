export interface RuntimeConfig {
  apiUrl: string;
  mapStyleUrl: string;
  /** Base URL of static public-data tiles (PMTiles + provenance JSON). */
  tilesUrl: string;
  /** Base URL of the open data files (GeoParquet 2.0, graph tables, semantic model). */
  openDataUrl: string;
  /** Anthropic-compatible endpoint for the talk-to-the-data assistant; empty = off. The
   *  endpoint adds the API key, so the key never reaches the browser. */
  llmUrl: string;
}

declare global {
  interface Window {
    __TABUSH_CONFIG__?: Partial<RuntimeConfig>;
  }
}

export const config: RuntimeConfig = {
  apiUrl: "",
  mapStyleUrl: "",
  tilesUrl: "/tiles",
  openDataUrl: "/open",
  llmUrl: "/llm",
  ...window.__TABUSH_CONFIG__,
};
