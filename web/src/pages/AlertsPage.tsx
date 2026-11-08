import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Alert } from "../api/types";
import { useTenant } from "../tenant";

const kindLabel: Record<Alert["kind"], string> = {
  deforestation: "Deforestation",
  embargo: "Embargo",
  drought_trigger: "Payout trigger",
  flood_event: "Flood",
  car_status: "CAR status",
};

export function AlertsPage() {
  const { tenant } = useTenant();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    if (tenant) api.listAlerts(tenant.id).then(setAlerts);
  }, [tenant]);
  return (
    <div className="page">
      <h1>Alerts</h1>
      <p className="muted">Events on properties with active loans or policies, newest first.</p>
      <ul className="alerts">
        {alerts.map((a) => (
          <li key={a.id} className={`alert alert-${a.kind}`}>
            <span className="alert-date mono">{a.date}</span>
            <span className="alert-kind">{kindLabel[a.kind]}</span>
            <span className="alert-title">
              <Link to={`/?car=${encodeURIComponent(a.carCode)}`}>{a.title}</Link>
              <div className="muted small">{a.source}</div>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
