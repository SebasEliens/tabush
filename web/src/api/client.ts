import { config } from "../config";
import { mockApi } from "./mock/mockApi";
import type { TabushApi } from "./types";

// Real HTTP client goes here once the FastAPI backend exists. Until then an
// empty apiUrl selects the in-browser mock, so the UI runs standalone.
export const api: TabushApi = config.apiUrl ? notImplemented(config.apiUrl) : mockApi;

function notImplemented(url: string): TabushApi {
  const fail = () => Promise.reject(new Error(`HTTP client for ${url} not implemented yet`));
  return {
    listTenants: fail,
    listProperties: fail,
    getProperty: fail,
    listTerritories: fail,
    listAlerts: fail,
    portfolioSummary: fail,
  };
}
