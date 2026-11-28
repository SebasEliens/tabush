import { MapPin } from "lucide-react";
import type { PublicLayerId, PublicLayerMeta, TenureFlag } from "../api/publicLayers";
import { dateLong, tenureFlagText } from "../format";
import { Button, MapPanel, Skeleton, Switch } from "../ui";

type Bbox = [number, number, number, number];

interface Props {
  /** undefined while loading, null when the layer's tiles haven't been built. */
  meta: Partial<Record<PublicLayerId, PublicLayerMeta | null>>;
  visible: Record<PublicLayerId, boolean>;
  onToggle: (id: PublicLayerId, on: boolean) => void;
  onFocus: (bbox: Bbox) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LABEL: Record<PublicLayerId, string> = {
  rural_properties: "Rural properties (CAR)",
  indigenous_lands: "Indigenous lands",
  protected_areas: "Protected areas",
};
const UNIT: Record<PublicLayerId, string> = { rural_properties: "records", indigenous_lands: "lands", protected_areas: "units" };
const INGEST: Record<PublicLayerId, string> = { rural_properties: "car", indigenous_lands: "indigenous_lands", protected_areas: "protected_areas" };

// Swatch per tenure finding, matching the map paint in MapView.
const FLAG_ROWS: { flags: TenureFlag[]; label: string; swatch: React.CSSProperties }[] = [
  { flags: ["indigenous_land", "public_protected_area"], label: "Overlaps indigenous or public protected land", swatch: { background: "var(--color-danger)" } },
  { flags: ["car_overlap"], label: "Overlaps another CAR claim on 20% or more", swatch: { background: "var(--color-warning)" } },
  { flags: ["none"], label: tenureFlagText.none, swatch: { border: "1.5px solid var(--color-parcel-outline)" } },
  { flags: ["not_assessed"], label: "Settlement, traditional or cancelled", swatch: { background: "var(--color-not-assessed)" } },
];

const count = (n: number) => n.toLocaleString("en-GB");

/** Map legend card for the public land-tenure layers: one switch per layer with its source and date. */
export function PublicLayersLegend({ meta, visible, onToggle, onFocus, open, onOpenChange }: Props) {
  const ids: PublicLayerId[] = ["rural_properties", "indigenous_lands", "protected_areas"];
  return (
    <MapPanel className="legend" label="Land tenure, public data" title="Land tenure · public data" open={open} onOpenChange={onOpenChange}>
      {ids.map((id) => {
        const m = meta[id];
        if (m === undefined) return <Skeleton key={id} width="80%" height={10} />;
        if (m === null)
          return (
            <span key={id}>
              {LABEL[id]} not loaded yet. Run <code>tabush.ingest.{INGEST[id]}</code> to build the layer.
            </span>
          );
        return (
          <div key={id} className="stack-2">
            <Switch
              checked={visible[id]}
              onChange={(on) => onToggle(id, on)}
              label={LABEL[id]}
              hint={`${count(m.features)} ${UNIT[id]} · ${m.source} · snapshot ${dateLong(m.snapshot_date)}`}
            />
            {visible[id] && id === "rural_properties" && <CarDetails m={m} onFocus={onFocus} />}
            {visible[id] && id === "protected_areas" && (
              <div className="legend__sub">
                <div><span className="legend__swatch" style={{ background: "var(--color-protected)", opacity: 0.45 }} />Must be public land</div>
                <div><span className="legend__swatch" style={{ background: "var(--color-protected-bg)", border: "1.5px solid var(--color-protected)" }} />Private land allowed</div>
              </div>
            )}
          </div>
        );
      })}
    </MapPanel>
  );
}

function CarDetails({ m, onFocus }: { m: PublicLayerMeta; onFocus: (bbox: Bbox) => void }) {
  return (
    <div className="legend__sub">
      {FLAG_ROWS.map((row) => (
        <div key={row.label} className="row-between">
          <span><span className="legend__swatch" style={row.swatch} />{row.label}</span>
          <span className="num">{count(row.flags.reduce((n, f) => n + (m.flags?.[f] ?? 0), 0))}</span>
        </div>
      ))}
      {!!m.municipalities?.length && (
        <div className="legend__places" aria-label="Go to pilot municipality">
          {m.municipalities.map((mun) => (
            <Button key={mun.name} size="sm" variant="ghost" icon={MapPin} onClick={() => onFocus(mun.bbox)}>
              {mun.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
