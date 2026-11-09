import { useEffect, useMemo, useState } from "react";
import { BellOff, CloudRain, FileWarning, Gavel, Sun, Trees, type LucideIcon } from "lucide-react";
import { api } from "../api/client";
import type { Alert } from "../api/types";
import { dateLong } from "../format";
import { useTenant } from "../tenant";
import { ButtonLink, Card, EmptyState } from "../ui";

const kinds: Record<Alert["kind"], { label: string; icon: LucideIcon; tone: "danger" | "warning" | "info" }> = {
  deforestation: { label: "Deforestation", icon: Trees, tone: "danger" },
  embargo: { label: "Embargo", icon: Gavel, tone: "danger" },
  car_status: { label: "CAR status", icon: FileWarning, tone: "warning" },
  drought_trigger: { label: "Payout trigger", icon: Sun, tone: "warning" },
  flood_event: { label: "Flood", icon: CloudRain, tone: "info" },
};

export function AlertsPage() {
  const { tenant } = useTenant();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<Alert["kind"] | "all">("all");
  useEffect(() => {
    if (tenant) api.listAlerts(tenant.id).then(setAlerts);
  }, [tenant]);

  const counts = useMemo(() => {
    const c: Partial<Record<Alert["kind"], number>> = {};
    alerts.forEach((a) => (c[a.kind] = (c[a.kind] ?? 0) + 1));
    return c;
  }, [alerts]);
  const shown = alerts.filter((a) => filter === "all" || a.kind === filter);
  const groups = shown.reduce<Record<string, Alert[]>>((g, a) => {
    const k = new Date(a.date + "T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    (g[k] ??= []).push(a);
    return g;
  }, {});

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Alerts</h1>
          <p>New events on properties with an active loan or policy, newest first.</p>
        </div>
      </div>

      <div className="filters" role="group" aria-label="Filter alerts">
        <button className="chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          All <span className="chip__count">{alerts.length}</span>
        </button>
        {(Object.keys(kinds) as Alert["kind"][]).filter((k) => counts[k]).map((k) => {
          const { label, icon: Icon } = kinds[k];
          return (
            <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              <Icon size={14} aria-hidden />{label} <span className="chip__count">{counts[k]}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 && <Card><EmptyState icon={BellOff} title="No alerts">Nothing new on your properties. We check sources daily.</EmptyState></Card>}

      {Object.entries(groups).map(([month, items]) => (
        <section className="alert-group" key={month}>
          <h2>{month}</h2>
          <div className="ui-card">
            <ul className="alert-list">
              {items.map((a) => {
                const k = kinds[a.kind];
                return (
                  <li key={a.id} className="alert-row">
                    <span className={`alert-icon alert-icon--${k.tone}`}><k.icon size={18} aria-hidden /></span>
                    <div>
                      <div className="alert-row__title">{a.title}</div>
                      <div className="alert-row__meta">{k.label} · {dateLong(a.date)} · {a.source}</div>
                    </div>
                    <ButtonLink to={`/?car=${encodeURIComponent(a.carCode)}`} size="sm">View on map</ButtonLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
