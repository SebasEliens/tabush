import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AlertsPage } from "./pages/AlertsPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { ReportPage } from "./pages/ReportPage";
import { useTenant } from "./tenant";

export function App() {
  const { tenants, tenant, setTenantId } = useTenant();
  const isReport = useLocation().pathname.startsWith("/report");
  return (
    <div className="app">
      {!isReport && (
        <header className="topbar">
          <div className="brand">tabush<span className="brand-sub">climate risk · family farms</span></div>
          <nav>
            <NavLink to="/" end>Map</NavLink>
            <NavLink to="/portfolio">Portfolio</NavLink>
            <NavLink to="/alerts">Alerts</NavLink>
          </nav>
          <div className="spacer" />
          <span className="mock-badge">Mock data</span>
          <select value={tenant?.id ?? ""} onChange={(e) => setTenantId(e.target.value)} aria-label="Institution">
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </header>
      )}
      <main>
        <Routes>
          <Route path="/" element={<PropertiesPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/report/:carCode" element={<ReportPage />} />
        </Routes>
      </main>
    </div>
  );
}
