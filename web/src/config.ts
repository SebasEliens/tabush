export interface RuntimeConfig {
  apiUrl: string;
  mapStyleUrl: string;
}

declare global {
  interface Window {
    __TABUSH_CONFIG__?: Partial<RuntimeConfig>;
  }
}

export const config: RuntimeConfig = {
  apiUrl: "",
  mapStyleUrl: "",
  ...window.__TABUSH_CONFIG__,
};
