import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Protocol } from "pmtiles";
// MapLibre 6 loads its worker as a separate module; let Vite bundle it.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { config } from "../config";
import { PUBLIC_LAYER_STACK, tilesUrl, type PublicLayerId, type PublicLayerMeta, type TenureFlag } from "../api/publicLayers";
import type { RuralProperty, Territory } from "../api/types";
import { carStatusText, carTypeText, dateLong, hectares, sizeClassText, statusText, tenureFlagText, worstSeverity } from "../format";
import { highlight, ink, notAssessedColor, parcelOutline, protectedColor, riskRamp, statusColor, territoryColor } from "../design/tokens";

maplibregl.setWorkerUrl(workerUrl);
// Public layers are static PMTiles archives read with HTTP range requests.
maplibregl.addProtocol("pmtiles", new Protocol().tile);

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
  /** Real public layers whose tiles are available. */
  publicLayers: Partial<Record<PublicLayerId, PublicLayerMeta>>;
  visibleLayers: Record<PublicLayerId, boolean>;
  /** Fly to these lon/lat bounds; a new object each time the user asks. */
  focus?: { bbox: [number, number, number, number] };
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

export function MapView({ properties, territories, selected, colorBy, publicLayers, visibleLayers, focus, onSelect }: Props) {
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
      addPublicHover(map);
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
    for (const id of PUBLIC_LAYER_STACK) {
      const meta = publicLayers[id];
      if (meta) addPublicLayer(map, id, meta);
      for (const layer of PUBLIC_STYLE[id].layers) {
        if (map.getLayer(layer.id)) map.setLayoutProperty(layer.id, "visibility", visibleLayers[id] ? "visible" : "none");
      }
    }
  }, [publicLayers, visibleLayers]);

  useWhenReady(mapRef, (map) => {
    if (focus) map.fitBounds([[focus.bbox[0], focus.bbox[1]], [focus.bbox[2], focus.bbox[3]]], { padding: 40, duration: 900 });
  }, [focus]);

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

// Public land-tenure layers, drawn under the tenant's parcels in a fixed
// order (protected areas, then indigenous lands, then CAR records) whatever
// order their tiles arrive in.
type LayerSpec = Omit<maplibregl.FillLayerSpecification, "source" | "source-layer"> | Omit<maplibregl.LineLayerSpecification, "source" | "source-layer">;

const flagColor: maplibregl.ExpressionSpecification = [
  "match", ["get", "tenure_flag"],
  ["indigenous_land", "public_protected_area"], statusColor.block,
  "car_overlap", statusColor.warn,
  "not_assessed", notAssessedColor,
  parcelOutline,
];
const flagged: maplibregl.ExpressionSpecification = ["in", ["get", "tenure_flag"], ["literal", ["indigenous_land", "public_protected_area", "car_overlap"]]];
const byZoom = (lo: number, hi: number): maplibregl.ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 4, lo, 12, hi];

const PUBLIC_STYLE: Record<PublicLayerId, { layers: LayerSpec[]; hover: string }> = {
  protected_areas: {
    hover: "protected-areas-fill",
    layers: [
      // Stronger fill where the law requires public land.
      { id: "protected-areas-fill", type: "fill", paint: { "fill-color": protectedColor, "fill-opacity": ["case", ["get", "public_domain"], 0.16, 0.06] } },
      { id: "protected-areas-line", type: "line", paint: { "line-color": protectedColor, "line-width": byZoom(0.5, 1.75), "line-opacity": 0.9 } },
    ],
  },
  indigenous_lands: {
    hover: "indigenous-lands-fill",
    layers: [
      { id: "indigenous-lands-fill", type: "fill", paint: { "fill-color": territoryColor, "fill-opacity": 0.18 } },
      { id: "indigenous-lands-line", type: "line", paint: { "line-color": territoryColor, "line-width": byZoom(0.75, 2), "line-dasharray": [3, 2] } },
    ],
  },
  rural_properties: {
    hover: "rural-properties-fill",
    layers: [
      // Calm by default: only records with a finding get a coloured fill.
      { id: "rural-properties-fill", type: "fill", minzoom: 6, paint: { "fill-color": flagColor, "fill-opacity": ["case", flagged, 0.4, 0.04] } },
      { id: "rural-properties-line", type: "line", minzoom: 6, paint: { "line-color": flagColor, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.2, 14, 1.25], "line-opacity": 0.85 } },
    ],
  },
};

function addPublicLayer(map: maplibregl.Map, id: PublicLayerId, meta: PublicLayerMeta) {
  if (map.getSource(id)) return;
  map.addSource(id, { type: "vector", url: `pmtiles://${tilesUrl(`${meta.layer}.pmtiles`)}`, attribution: meta.source });
  // Insert under the first layer above us in the stack that's already on the map.
  const above = PUBLIC_LAYER_STACK.slice(PUBLIC_LAYER_STACK.indexOf(id) + 1)
    .map((other) => PUBLIC_STYLE[other].layers[0].id)
    .find((layerId) => map.getLayer(layerId));
  for (const layer of PUBLIC_STYLE[id].layers) {
    map.addLayer({ ...layer, source: id, "source-layer": meta.layer } as maplibregl.LayerSpecification, above ?? "territories-fill");
  }
  metaById[id] = meta;
}
const metaById: Partial<Record<PublicLayerId, PublicLayerMeta>> = {};

// One hover card for all public layers: the topmost record under the pointer,
// in plain words, with its source and snapshot date. The tenant's parcels sit
// on top and have their own card.
function addPublicHover(map: maplibregl.Map) {
  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, maxWidth: "320px" });
  const order = [...PUBLIC_LAYER_STACK].reverse();
  map.on("mousemove", (e) => {
    const hoverLayers = order.map((id) => PUBLIC_STYLE[id].hover).filter((l) => map.getLayer(l));
    if (!hoverLayers.length || map.queryRenderedFeatures(e.point, { layers: ["parcels-fill"] }).length) return popup.remove();
    const hits = map.queryRenderedFeatures(e.point, { layers: hoverLayers });
    const id = order.find((layer) => hits.some((f) => f.layer.id === PUBLIC_STYLE[layer].hover));
    const f = hits.find((h) => id && h.layer.id === PUBLIC_STYLE[id].hover);
    if (!id || !f) return popup.remove();
    popup.setLngLat(e.lngLat).setHTML(hoverCard(id, f.properties ?? {}, metaById[id]!)).addTo(map);
  });
  map.getCanvas().addEventListener("mouseleave", () => popup.remove());
}

function hoverCard(id: PublicLayerId, p: Record<string, unknown>, meta: PublicLayerMeta): string {
  const muted = (html: string) => `<span style="color:var(--color-text-secondary)">${html}</span>`;
  const source = `${escapeHtml(meta.source)} · snapshot ${dateLong(meta.snapshot_date)}`;
  if (id === "indigenous_lands") {
    return `<strong>Indigenous land: ${escapeHtml(p.name)}</strong><br/>` +
      muted(`${escapeHtml(p.phase)} · ${hectares(Number(p.area_ha))}<br/>${source}`);
  }
  if (id === "protected_areas") {
    const land = p.public_domain ? "Must be public land" : "Private land allowed";
    return `<strong>${escapeHtml(titleCase(String(p.name)))}</strong><br/>` +
      muted(`${escapeHtml(p.category)} · ${escapeHtml(p.sphere)} · ${land}<br/>${hectares(Number(p.area_ha))} · ${source}`);
  }
  const flag = p.tenure_flag as TenureFlag;
  const share = (col: string) => `${Math.round(Number(p[col]))}% of its area`;
  const finding =
    flag === "indigenous_land" ? `${tenureFlagText[flag]} on ${share("indigenous_overlap_pct")}`
    : flag === "public_protected_area" ? `${tenureFlagText[flag]} on ${share("protected_overlap_pct")}`
    : flag === "car_overlap" ? `${tenureFlagText[flag]} on ${share("car_overlap_pct")} (${p.car_overlap_count} record${Number(p.car_overlap_count) === 1 ? "" : "s"})`
    : flag === "not_assessed" ? "Not assessed: settlements, traditional territories and cancelled records are expected to overlap"
    : tenureFlagText.none;
  const tone = flag === "car_overlap" ? "warning" : flag === "none" || flag === "not_assessed" ? "secondary" : "danger";
  const size = p.size_class ? `<br/>${escapeHtml(sizeClassText[String(p.size_class)])}` : "";
  return `<strong>${escapeHtml(carTypeText[String(p.property_type)] ?? p.property_type)} · ${hectares(Number(p.area_ha))}</strong><br/>` +
    `<span style="color:var(--color-${tone === "secondary" ? "text-secondary" : `${tone}-text`})">${escapeHtml(finding)}</span>` +
    muted(`${size}<br/>CAR ${escapeHtml(p.source_id)}<br/>${escapeHtml(carStatusText[String(p.status)] ?? p.status)} · ${escapeHtml(p.municipality)} · registered ${dateLong(String(p.registered_on))}<br/>${source}`);
}

const titleCase = (s: string) => s.toLocaleLowerCase("pt-BR").replace(/(^|\s)(\p{L})/gu, (_, sp, c) => sp + c.toLocaleUpperCase("pt-BR")).replace(/ (D[aeo]s?|E) /g, (m) => m.toLowerCase());

const escapeHtml = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

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
