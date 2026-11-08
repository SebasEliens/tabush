import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Bell, Map as MapIcon, Palette, PieChart } from "lucide-react";
import { AlertsPage } from "./pages/AlertsPage";
import { DesignPage } from "./pages/DesignPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { ReportPage } from "./pages/ReportPage";
import { useTenant } from "./tenant";
import { Badge, ButtonLink, Select } from "./ui";
import { Logo } from "./ui/Logo";

export function App() {
  const { tenants, tenant, setTenantId } = useTenant();
  const isReport = useLocation().pathname.startsWith("/report");
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
          </nav>
          <div className="topbar__spacer" />
          <Badge tone="mock">Mock data</Badge>
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
          <Route path="/report/:carCode" element={<ReportPage />} />
          <Route path="/design" element={<DesignPage />} />
        </Routes>
      </main>
    </div>
  );
}
