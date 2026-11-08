import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 loads its worker as a separate module; let Vite bundle it.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { config } from "../config";
import type { RuralProperty, Territory } from "../api/types";
import { worstSeverity } from "../format";

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
  layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.6, "raster-opacity": 0.85 } }],
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
      id: p.carCode,
      geometry: p.geometry,
      properties: { carCode: p.carCode, name: p.name, risk: p.risk.overall, status: worstSeverity(p) },
    })),
  };
}

const riskColor: maplibregl.ExpressionSpecification = [
  "interpolate", ["linear"], ["get", "risk"],
  0.1, "#fde9b8", 0.35, "#f6a15a", 0.6, "#d9472b", 0.85, "#7f1d1d",
];
const complianceColor: maplibregl.ExpressionSpecification = [
  "match", ["get", "status"], "block", "#c62828", "warn", "#e6a100", "#2e7d5b",
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
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");
    map.on("load", () => {
      map.addSource("territories", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("parcels", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "territories-fill", type: "fill", source: "territories", paint: { "fill-color": "#6a4c93", "fill-opacity": 0.12 } });
      map.addLayer({ id: "territories-line", type: "line", source: "territories", paint: { "line-color": "#6a4c93", "line-width": 2, "line-dasharray": [3, 2] } });
      map.addLayer({ id: "parcels-fill", type: "fill", source: "parcels", paint: { "fill-color": riskColor, "fill-opacity": 0.65 } });
      map.addLayer({ id: "parcels-line", type: "line", source: "parcels", paint: { "line-color": "#ffffff", "line-width": 1 } });
      map.addLayer({ id: "parcels-selected", type: "line", source: "parcels", filter: ["==", ["get", "carCode"], ""], paint: { "line-color": "#111827", "line-width": 3 } });
      map.on("click", "parcels-fill", (e) => {
        const car = e.features?.[0]?.properties?.carCode;
        if (car) onSelectRef.current(car);
      });
      map.on("mouseenter", "parcels-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "parcels-fill", () => (map.getCanvas().style.cursor = ""));
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
