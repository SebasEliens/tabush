export interface RuntimeConfig {
  apiUrl: string;
  mapStyleUrl: string;
  /** Base URL of static public-data tiles (PMTiles + provenance JSON). */
  tilesUrl: string;
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
  ...window.__TABUSH_CONFIG__,
};
