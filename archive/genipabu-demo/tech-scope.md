# Genipabu / Extremoz Vegetation Intelligence Demo — Technical Scope

AOI: Subestação Extremoz + Rio do Fogo / Rio do Vento corridors + APA Jenipabu dune-restinga system, RN, Brazil.
Goal: weekend-buildable proof of concept for an Overstory-style vegetation-risk pipeline, in a coastal-dune/wind-grid context their current US/EU product likely hasn't been tuned for.

---

## 1. Data sources

### 1.1 Satellite imagery (optical)
- **Sentinel-2 L2A** (10m, 5-day revisit, free) — primary imagery source. Access via [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/) or directly in [Google Earth Engine](https://developers.google.com/earth-engine/datasets/catalog/sentinel-2). No approval wait — usable immediately.
- **Planet NICFI tropical basemaps** (4.77m, monthly, free for non-commercial/conservation use) — sharper than Sentinel-2, good for dune/vegetation boundary precision. Requires signup approval (may not land within a weekend) via [Planet NICFI GEE integration](https://developers.planet.com/docs/integrations/gee/nicfi/). Treat as stretch/optional — check on Friday if you want it in play.
- **High-res basemap fallback**: Esri World Imagery or Google/Bing basemap tiles for visual context layers in maps (not for analysis, just presentation).

### 1.2 Vegetation / land-cover derived layers
- **ESA WorldCover 2021** (10m global land cover, incl. built-up, bare/sparse veg, mangroves) — [esa-worldcover.org](https://esa-worldcover.org/en), also in GEE catalog. Good coarse base layer for restinga vs. bare dune vs. built context.
- **Meta/WRI Global Canopy Height Map** (1m resolution, MAE ~2.8m, derived from DINOv2 + Maxar) — useful proxy for "tall vegetation near lines" even without LiDAR. [ai.meta.com/ai-for-good/datasets/canopy-height-maps](https://ai.meta.com/ai-for-good/datasets/canopy-height-maps/), also on [GEE community catalog](https://gee-community-catalog.org/projects/meta_trees/).
- **NDVI/NDMI time series** — computed directly from Sentinel-2 bands (no separate dataset needed); use for detecting vegetation growth/greening trend over 1–2 years near the corridor.

### 1.3 Infrastructure (grid) vector data
- **ANEEL SIGEL** (Sistema de Informações Georreferenciadas do Setor Elétrico) — Brazil's official transmission-line/substation geodata, ArcGIS Server-based. Accessible via `restapi` + `open_geodata` Python packages; see this [worked example](https://open-geodata.readthedocs.io/pt-br/latest/pages/dados/br/aneel_arcgis/). This is the authoritative source — check first.
- **OpenStreetMap** — fallback/cross-check for `power=line`, `power=substation`, `power=tower` tags ([tag reference](https://wiki.openstreetmap.org/wiki/Key:power)). Pull via [Overpass Turbo](https://overpass-turbo.eu/) or the `osmnx` Python package. Coverage for Brazilian infra is inconsistent — verify Extremoz substation + Rio do Fogo 69kV line are actually mapped before relying on it.

### 1.4 Protected-area / context layers (optional polish)
- APA Jenipabu boundary — check Brazil's official protected-areas dataset, **CNUC/MMA** (Cadastro Nacional de Unidades de Conservação), or IDEMA-RN (state environmental agency) for a shapefile. Worth 15 minutes of searching; if not readily available, hand-digitize a rough boundary from the imagery for the visual — it's a demo, not a legal filing.

---

## 2. Python stack

Core geospatial:
- `geopandas`, `shapely`, `rasterio`, `rioxarray`, `xarray` — vector/raster handling
- `earthengine-api` + `geemap` — GEE access and interactive mapping ([geemap.org](https://geemap.org/))
- `restapi` + `open_geodata` — ANEEL SIGEL access (see §1.3)
- `osmnx` — OSM infra pull (fallback)
- `pyproj` — CRS handling (expect UTM 25S / EPSG:32725 for this AOI)

ML / modeling:
- `torch` + `torchgeo` — geospatial-aware PyTorch utilities, dataset wrappers, pretrained backbones ([torchgeo.readthedocs.io](https://torchgeo.readthedocs.io/))
- `segment-anything` (SAM) or `samgeo` (geospatial wrapper around SAM) — zero-shot vegetation-clump/tree-crown segmentation without training ([SAM repo](https://github.com/facebookresearch/segment-anything))
- `DeepForest` — pretrained tree-crown detection/delineation model, fine-tunable ([deepforest.readthedocs.io](https://deepforest.readthedocs.io/))
- `scikit-learn` — simple NDVI-threshold or random-forest land-cover classifier if you want something interpretable/fast rather than deep-learning-heavy

Analysis/glue:
- `numpy`, `pandas`
- `shapely.ops` for buffering transmission corridors and intersecting with vegetation/canopy layers

Visualization:
- `geemap` / `folium` — interactive web maps
- `matplotlib` + `contextily` — static publication-quality figures with basemap
- `kepler.gl` (via `keplergl` Python wrapper) — polished risk-heatmap-style visuals, good for a demo deck
- Optional: `streamlit` — wrap the whole thing into a 1-page interactive app to send them a link instead of a static deck

---

## 3. Models + fine-tuning considerations

Given the one-weekend budget, **don't train from scratch**. Three tiers, pick based on remaining time Saturday night:

1. **No training (fastest, recommended default):** NDVI/NDMI thresholding + WorldCover masking + canopy-height masking, combined via simple rules into a risk score per corridor segment. Fully defensible, transparent, explainable in an interview — which matters more here than model sophistication.
2. **Zero-shot segmentation (if time allows):** Run SAM/samgeo on Sentinel-2 or NICFI imagery to delineate individual vegetation clumps/tree crowns near the line buffer, no fine-tuning needed. Good visual "tree-level" story that mirrors Overstory's own language.
3. **Light fine-tuning (stretch, only if very comfortable already):** Fine-tune DeepForest's pretrained crown-detection head on a handful of manually labeled restinga/dune-scrub examples from your AOI, since its base training data (temperate/US forests) won't generalize well to sparse dune vegetation. Frame this explicitly as the "here's the domain-gap problem, here's a fast way to start closing it" talking point — this is likely your single best differentiator in the pitch, since it shows you understand transfer-learning limits rather than just running a pretrained model uncritically.

---

## 4. Analysis pipeline (sequence)

1. Define AOI + pull ANEEL/OSM line geometry for Extremoz substation + Rio do Fogo (and Rio do Vento if time) corridors.
2. Buffer corridor by realistic vegetation-management distance (e.g. 10–30m either side — check Brazilian regulatory clearance distances if you want a cited number, ANEEL/ONS publish these).
3. Pull Sentinel-2 (+ NICFI if available) for 2 time points (e.g. 2022 vs. 2025) over the buffered corridor.
4. Compute NDVI/NDMI, canopy height, and WorldCover class per segment.
5. Segment/classify vegetation (tier 1–3 above) and score each corridor segment for encroachment risk.
6. Produce a change-detection layer (growth between time points) to show trend, not just a snapshot.
7. Package outputs into map + one-pager.

---

## 5. Visualization / deliverable format

- **Primary artifact:** interactive map (geemap/folium or a small Streamlit app) showing the corridor, risk-scored segments (color-coded), and a toggleable before/after imagery slider.
- **Supporting:** 1-page write-up — problem framing, method, key finding (e.g. "N segments flagged high-risk," "X% canopy growth 2022→2025"), and an explicit "what I'd do with production data/time" section (fuse with DETER/PRODES-style deforestation alerts, get real regulatory clearance distances, validate against ANEEL outage records if public).
- Keep both under a 10-minute walkthrough — the goal is demonstrating judgment and domain fluency, not shipping a finished product.

---

## 6. Open items to verify before Saturday

- [ ] Confirm ANEEL SIGEL layer names/endpoints for transmission lines + substations (test the `restapi` connection early — ArcGIS REST quirks can eat time)
- [ ] Cross-check OSM coverage for Extremoz substation and Rio do Fogo line as a fallback/sanity check
- [ ] Check NICFI signup status Friday — don't block on it
- [ ] Look for APA Jenipabu official boundary (CNUC/MMA or IDEMA-RN) — nice-to-have, not critical
