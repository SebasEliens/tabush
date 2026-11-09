# Tabush — Climate-risk platform for Brazilian family farmers

**Product:** A rural property knowledge graph that supports compliance checks, climate-risk scoring and parametric insurance indices for family farmers in Brazil. Customers are credit co-ops, banks and insurers. The same graph could later power cattle supply-chain intelligence.
**Goal:** Better access to credit and insurance for climate-exposed family farmers (climate justice), paid for by lenders and insurers (profitability).
**Design docs:** `docs/research/`, starting with `technical-requirements.md`.

---

## Developer disciplines

**Environment:** Use `uv` for all Python package and environment management. Never use `pip` directly. Run code with `uv run ...`.

**Libraries:** Prefer libraries over custom implementations. Before writing any non-trivial utility, check whether a well-regarded, actively maintained library already covers it.

**Git:** Commit and push atomic slices of work, one logical step per commit (e.g. one ingest source, one schema change, one score component).

**Git hooks (pre-commit):** Config lives in `.pre-commit-config.yaml` (committed). Install after clone with `uvx pre-commit install`. Run on everything with `uvx pre-commit run --all-files`.

**Tests and lint:** `uv run pytest` and `uv run ruff check .` must pass before pushing.

**Data:** Never commit data. Raw and derived data live under `data/` (gitignored) or in object storage. Credentials go in `.env` (gitignored). Use `.env.example` to document required variables.

---

## Stack (see `docs/research/technical-requirements.md` §3)

- **Orchestration:** Dagster, with one versioned asset per data source and dated snapshots so every report can be reproduced.
- **Storage:** GeoParquet (vectors), COG/Zarr (rasters), STAC catalog. **PostGIS** is the source of truth for geometry and runs overlap queries.
- **Raster processing:** xarray, Dask, odc-stac, rasterio. Use Google Earth Engine for prototyping only, never for production.
- **Spatial join key:** H3 cells at resolution 8–9.
- **Knowledge graph:** TypeDB 3.x. Its schema in `schema/` *is* the ontology. Geometry stays in PostGIS; the graph stores H3 cells and overlap results. Neo4j is the fallback if the phase-0 spike fails.
- **CRS:** Store in EPSG:4674 (SIRGAS 2000, Brazil's official datum) or EPSG:4326. For area and distance, reproject to an equal-area projection (e.g. EPSG:5880, Brazil Polyconic) instead of using degrees.

## Data sources (phase 0)

SICAR/CAR property boundaries, INCRA SIGEF land titles, FUNAI indigenous lands, INCRA quilombola and settlement areas, ICMBio/CNUC protected areas, SFB CNFP public forests, IBAMA embargoes, MapBiomas land use and alerts, INPE PRODES/DETER. Each ingested record keeps its `source`, `snapshot_date` and source ID.

## Ontology rules

- Reuse GeoSPARQL, SOSA/SSN, PROV-O, OWL-Time, FIBO and AGROVOC concepts and names where possible. Don't invent new ones when a standard term exists.
- Every relation carries `source`, `snapshot_date` and `confidence`, so each flag in a report traces back to a record.

## Privacy (LGPD)

Hash CPF at ingestion and never store it in plain text. Only use personal data that partners supplied with consent. Keep data in a Brazil region.

## Validation snippets

**CRS guard (call after any vector load):**
```python
def assert_crs(gdf, epsg=4674):
    assert gdf.crs and gdf.crs.to_epsg() == epsg, f"Expected EPSG:{epsg}, got {gdf.crs}"
```

**Geometry validity:**
```python
assert gdf.geometry.is_valid.all(), "Invalid geometries; run shapely.make_valid first"
```

**Provenance completeness:**
```python
assert {"source", "snapshot_date"} <= set(gdf.columns)
```

## Agent workflow hooks

After any edit to vector or raster I/O, run the CRS guard and the geometry validity check. Flag any script that writes data to disk without a matching `.gitignore` entry.
