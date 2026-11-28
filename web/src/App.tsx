import { lazy, Suspense } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Bell, Map as MapIcon, MessageSquareText, Palette, PieChart } from "lucide-react";
import { AlertsPage } from "./pages/AlertsPage";
import { DesignPage } from "./pages/DesignPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { ReportPage } from "./pages/ReportPage";
import { tenureDataMode, usePublicLayerMeta } from "./api/publicLayers";
import { useTenant } from "./tenant";
import { Badge, ButtonLink, Select } from "./ui";
import { Logo } from "./ui/Logo";

// DuckDB-WASM and the Claude SDK only load when someone opens "Ask the data".
const AskPage = lazy(() => import("./pages/AskPage").then((m) => ({ default: m.AskPage })));

export function App() {
  const { tenants, tenant, setTenantId } = useTenant();
  const { pathname } = useLocation();
  const isReport = pathname.startsWith("/report");
  // The map drops its fake portfolio once real land tenure data is loaded; /ask only ever uses open data.
  const realMap = tenureDataMode(usePublicLayerMeta()) !== "mock" && pathname === "/";
  const isOpenData = pathname.startsWith("/ask") || realMap;
  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      {!isReport && (
        <header className="topbar">
          <Logo tone="on-brand" />
          <nav aria-label="Main">
            <NavLink to="/" end><MapIcon size={16} aria-hidden />Map</NavLink>
            <NavLink to="/portfolio"><PieChart size={16} aria-hidden />Portfolio</NavLink>
            <NavLink to="/alerts"><Bell size={16} aria-hidden />Alerts</NavLink>
            <NavLink to="/ask"><MessageSquareText size={16} aria-hidden />Ask the data</NavLink>
          </nav>
          <div className="topbar__spacer" />
          {!isOpenData && <Badge tone="mock">Mock data</Badge>}
          <label className="topbar__tenant">
            Institution
            <Select value={tenant?.id ?? ""} onChange={(e) => setTenantId(e.target.value)}>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </label>
          <ButtonLink to="/design" variant="ghost" iconOnly icon={Palette} aria-label="Design system" title="Design system" />
        </header>
      )}
      <main id="main">
        <Routes>
          <Route path="/" element={<PropertiesPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/ask" element={<Suspense fallback={null}><AskPage /></Suspense>} />
          <Route path="/report/:carCode" element={<ReportPage />} />
          <Route path="/design" element={<DesignPage />} />
        </Routes>
      </main>
    </div>
  );
}
