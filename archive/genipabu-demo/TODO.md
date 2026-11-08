# TODO

Tracks planned work in pipeline order. Each item maps to one atomic commit.  
Move items to `CHANGELOG.md` when done.

---

## Milestone 1 — Corridor geometry

- [ ] `notebooks/01_corridor.ipynb` — fetch Extremoz substation + Rio do Fogo line from ANEEL SIGEL; OSM fallback if endpoint fails
- [ ] Buffer corridor 30 m either side (check ANEEL/ONS regulatory clearance distance and cite if different)
- [ ] Plot buffered corridor on basemap; confirm geometry covers the right AOI visually
- [ ] Export corridor GeoPackage to `data/corridor.gpkg` (gitignored)

## Milestone 2 — Imagery

- [ ] `notebooks/02_imagery.ipynb` — authenticate GEE, pull Sentinel-2 L2A for two epochs: 2022-Q1 and 2025-Q1
- [ ] Clip to buffered corridor AOI
- [ ] Show true-color composite + NDVI for both epochs side by side

## Milestone 3 — Risk scoring

- [ ] `notebooks/03_risk.ipynb` — compute NDVI, NDMI, canopy height per corridor segment
- [ ] Apply WorldCover mask (restinga / bare dune / built-up classification)
- [ ] Produce rule-based risk score [0–1] per segment
- [ ] Compute change-detection layer (NDVI delta 2022→2025)

## Milestone 4 — Visualization

- [ ] `notebooks/04_map.ipynb` — folium map with risk-colored segments + before/after imagery slider
- [ ] One-page write-up: problem framing, method, key finding, "what's next" section
- [ ] Decide: export static folium HTML or wrap in Streamlit app

## Backlog

- [ ] Check NICFI signup status — upgrade imagery resolution if approved
- [ ] Source APA Jenipabu official boundary (CNUC/MMA or IDEMA-RN)
- [ ] DeepForest fine-tune on restinga/dune-scrub samples (stretch goal)
