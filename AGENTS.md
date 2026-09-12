# Tabush — Vegetation-Risk Pipeline Demo

**Project:** Overstory-style vegetation encroachment risk demo for Brazilian transmission corridors.  
**AOI:** Subestação Extremoz + Rio do Fogo / Rio do Vento corridors + APA Jenipabu dune-restinga system, RN, Brazil.  
**CRS:** UTM 25S / EPSG:32725  
**Output:** Interactive map (folium or Streamlit) — risk-scored corridor segments + before/after imagery slider (2022 vs. 2025). Walkthrough under 10 minutes.

---

## Developer disciplines

**Environment:** Use `uv` for all Python package and environment management. Never use `pip` directly.

**Libraries:** Prefer libraries over custom implementations. Before writing any non-trivial utility, verify a well-regarded, actively maintained library doesn't already cover it. Do not reinvent the wheel.

**Git:** Commit and push atomic slices of work — one logical step per commit (e.g. data fetch, corridor buffer, NDVI compute, risk scoring, visualization).

**Git hooks (Lefthook):** Config lives in `lefthook.yml` (committed). Install after clone with `uvx lefthook install`.

---

## Project: Data sources

- **Imagery:** Sentinel-2 L2A via Google Earth Engine (`earthengine-api` / `geemap`) — primary. NICFI basemaps via GEE if signup approved (optional).
- **Grid infrastructure:** ANEEL SIGEL (ArcGIS REST, `restapi` + `open_geodata`); OSM (`osmnx`) as fallback.
- **Canopy height:** Meta/WRI Global Canopy Height Map (GEE community catalog).
- **Land cover:** ESA WorldCover 2021 (GEE catalog).

## Project: Default analysis tier

Start with **Tier 1 (no ML):** NDVI/NDMI thresholding + WorldCover + canopy-height masking → rule-based risk score per corridor segment. Only escalate to SAM/samgeo or DeepForest fine-tuning if Tier 1 is complete and time allows.

## Project: Validation snippets

Run before each commit to confirm the pipeline step is sound.

**GEE auth:**
```python
import ee; ee.Initialize(); print(ee.String("GEE OK").getInfo())
```

**ANEEL SIGEL connection:**
```python
from restapi import ArcServer
s = ArcServer("https://sigel.aneel.gov.br/arcgis/rest/services")
print([l.name for l in s.services[:5]])
```

**CRS guard (call after any vector load):**
```python
def assert_utm25s(gdf):
    assert gdf.crs and gdf.crs.to_epsg() == 32725, f"Expected EPSG:32725, got {gdf.crs}"
```

**NDVI sanity:**
```python
assert ndvi.min() >= -1 and ndvi.max() <= 1
assert (ndvi > 0.2).mean() > 0.05, "Less than 5% vegetated pixels — check band order"
```

**Risk score completeness:**
```python
assert segments["risk_score"].between(0, 1).all()
assert segments["risk_score"].notna().all()
```

## Project: Skills (run only when needed)

_No scripts yet — add entries here as `scripts/` are created._

## Project: Agent workflow hooks

After any edit touching raster or vector I/O, run the CRS guard and NDVI sanity check. Flag scripts that write data to disk without a corresponding `.gitignore` entry.
