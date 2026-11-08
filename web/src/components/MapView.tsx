import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 loads its worker as a separate module; let Vite bundle it.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { config } from "../config";
import type { RuralProperty, Territory } from "../api/types";
import { statusText, worstSeverity } from "../format";
import { highlight, ink, riskRamp, statusColor, territoryColor } from "../design/tokens";

maplibregl.setWorkerUrl(workerUrl);

export type ColorBy = "risk" | "compliance";

// Vendor-neutral default: plain OSM raster tiles. Point mapStyleUrl at any
// MapLibre style (self-hosted PMTiles, MapTiler, etc.) to swap it.
const osmStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.75, "raster-opacity": 0.8, "raster-contrast": -0.1 } }],
};

interface Props {
  properties: RuralProperty[];
  territories: Territory[];
  selected?: string;
  colorBy: ColorBy;
  onSelect: (carCode: string) => void;
}

function toFC(properties: RuralProperty[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: properties.map((p) => ({
      type: "Feature",

      geometry: p.geometry,
      properties: { carCode: p.carCode, name: p.name, risk: p.risk.overall, status: worstSeverity(p) },
    })),
  };
}

const riskColor: maplibregl.ExpressionSpecification = [
  "interpolate", ["linear"], ["get", "risk"],
  0.1, riskRamp[0], 0.3, riskRamp[1], 0.45, riskRamp[2], 0.6, riskRamp[3], 0.8, riskRamp[4],
];
const complianceColor: maplibregl.ExpressionSpecification = [
  "match", ["get", "status"], "block", statusColor.block, "warn", statusColor.warn, statusColor.ok,
];

export function MapView({ properties, territories, selected, colorBy, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: ref.current!,
      style: config.mapStyleUrl || osmStyle,
      center: [-52.675, -31.395],
      attributionControl: { compact: true },
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");
    map.on("load", () => {
      map.addSource("territories", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("parcels", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "carCode" });
      map.addLayer({ id: "territories-fill", type: "fill", source: "territories", paint: { "fill-color": territoryColor, "fill-opacity": 0.14 } });
      map.addLayer({ id: "territories-line", type: "line", source: "territories", paint: { "line-color": territoryColor, "line-width": 2, "line-dasharray": [3, 2] } });
      map.addLayer({ id: "parcels-fill", type: "fill", source: "parcels", paint: { "fill-color": riskColor, "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.9, 0.72] } });
      map.addLayer({ id: "parcels-line", type: "line", source: "parcels", paint: { "line-color": "#ffffff", "line-width": 1 } });
      map.addLayer({ id: "parcels-selected", type: "line", source: "parcels", filter: ["==", ["get", "carCode"], ""], paint: { "line-color": ink, "line-width": 4 } });
      map.addLayer({ id: "parcels-selected-inner", type: "line", source: "parcels", filter: ["==", ["get", "carCode"], ""], paint: { "line-color": highlight, "line-width": 2 } });
      map.on("click", "parcels-fill", (e) => {
        const car = e.features?.[0]?.properties?.carCode;
        if (car) onSelectRef.current(car);
      });
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
      let hovered: string | number | undefined;
      map.on("mousemove", "parcels-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";
        if (hovered !== undefined) map.setFeatureState({ source: "parcels", id: hovered }, { hover: false });
        hovered = f.id;
        if (hovered !== undefined) map.setFeatureState({ source: "parcels", id: hovered }, { hover: true });
        const { name, risk, status } = f.properties as { name: string; risk: number; status: keyof typeof statusText };
        popup.setLngLat(e.lngLat).setHTML(`<strong>${name}</strong><br/><span style="color:var(--color-text-secondary)">${statusText[status]} · risk ${Number(risk).toFixed(2)}</span>`).addTo(map);
      });
      map.on("mouseleave", "parcels-fill", () => {
        map.getCanvas().style.cursor = "";
        if (hovered !== undefined) map.setFeatureState({ source: "parcels", id: hovered }, { hover: false });
        hovered = undefined;
        popup.remove();
      });
      mapRef.current = map;
    });
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useWhenReady(mapRef, (map) => {
    (map.getSource("parcels") as maplibregl.GeoJSONSource).setData(toFC(properties));
    (map.getSource("territories") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: territories.map((t) => ({ type: "Feature", geometry: t.geometry, properties: { name: t.name } })),
    });
  }, [properties, territories]);

  useWhenReady(mapRef, (map) => {
    map.setPaintProperty("parcels-fill", "fill-color", colorBy === "risk" ? riskColor : complianceColor);
  }, [colorBy]);

  useWhenReady(mapRef, (map) => {
    map.setFilter("parcels-selected", ["==", ["get", "carCode"], selected ?? ""]);
    map.setFilter("parcels-selected-inner", ["==", ["get", "carCode"], selected ?? ""]);
    const p = properties.find((x) => x.carCode === selected);
    if (p) {
      const ring = p.geometry.coordinates[0];
      const lons = ring.map((c) => c[0]);
      const lats = ring.map((c) => c[1]);
      map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 120, maxZoom: 13.5, duration: 600 });
    }
  }, [selected, properties]);

  return <div ref={ref} className="map" />;
}

// Runs fn once the map has loaded, and again whenever deps change.
function useWhenReady(
  mapRef: React.RefObject<maplibregl.Map | null>,
  fn: (map: maplibregl.Map) => void,
  deps: unknown[],
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      fnRef.current(map);
      return;
    }
    const id = setInterval(() => {
      if (mapRef.current) {
        clearInterval(id);
        fnRef.current(mapRef.current);
      }
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
