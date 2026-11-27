# TODO

Phase 0 (months 0–3): one pilot municipality, compliance report (C1), first ontology.
Each item maps to one atomic commit. Move items to `CHANGELOG.md` when done.

---

## Milestone 0 — Decisions and environment

- [ ] Pick the pilot municipality (family-farm heavy, co-op partner likely, good CAR coverage)
- [ ] `docker-compose.yml` with PostGIS and TypeDB 3.x Community Edition
- [ ] TypeDB spike: load `schema/core.tql`, insert sample data, test multi-hop queries and LLM text-to-TypeQL; decide TypeDB vs Neo4j

## Milestone 1 — Ingest (one module per source in `src/tabush/ingest/`)

- [x] SICAR/CAR property boundaries and status for pilot municipalities (public WFS), with legal size class, shown on the web map
- [ ] INCRA SIGEF land titles (INCRA's servers refuse non-Brazil IPs: needs a Brazil-hosted run)
- [x] FUNAI indigenous lands (IBGE Census 2022 copy; FUNAI's own server for Brazil-hosted runs), shown on the web map as PMTiles
- [x] CNUC protected areas, with public-domain categories per SNUC, shown on the web map
- [ ] Territories: INCRA quilombolas and settlements, SFB CNFP public forests (both block non-Brazil IPs)
- [ ] IBAMA embargoes (+ state list if available) and MTE *lista suja*
- [ ] MapBiomas land use and Alerta; INPE PRODES/DETER
- [ ] Each source: provenance columns, CRS guard, validity check, dated GeoParquet snapshot, load to PostGIS

## Milestone 2 — Overlaps and graph

- [x] Tenure overlaps in GeoPandas: CAR × CAR, CAR × indigenous land, CAR × public protected area (`tabush.risk.tenure_overlaps`)
- [ ] Move overlap queries to PostGIS; add property × embargo, property × deforestation, CAR × SIGEF (IoU)
- [ ] H3 indexing of parcels (res 9)
- [ ] Load entities and overlap relations into the graph with `source`, `snapshot_date`, `confidence`
- [x] Flag duplicate/suspicious CAR overlaps (`tenure_flag`, overlap rows with confidence)
- [ ] Validate overlap thresholds against a hand-checked sample in the pilot municipality

## Milestone 3 — Compliance report (C1)

- [ ] `POST /checks`-style function: CAR code → pass/flag report with evidence
- [ ] Report output (HTML/PDF) with map and source citations for each flag
- [ ] Hand-label a sample to measure property-to-record link precision (target ≥95%)

## Milestone 2b — Open data and talk to the data

- [x] Semantic layer: SKOS taxonomy and OWL ontology bound to the published tables (`semantic/`)
- [x] Publish open data as GeoParquet 2.0 plus `nodes`/`edges`/`concepts` tables (`tabush.semantic.publish`)
- [x] "Ask the data" page: Claude writes DuckDB-WASM SQL guided by the semantic layer
- [x] Feature files + golden questions + Playwright screenshots in CI
- [ ] LLM gateway for production (Brazil region), with a PROV-O audit log of each tool call
- [ ] Publish `data/open/` on object storage + CDN with attribution per source
- [ ] AlphaEarth embeddings per parcel: `similar_parcels` tool and land-use gap filling
- [ ] Company ownership chains from public CNPJ/QSA data (`tabush:Party`, `holdsRight`)
- [ ] Export the semantic model as WrenAI MDL if the assistant moves server-side

## Backlog

- [ ] Dagster orchestration once more than two sources are ingested
- [ ] OWL/SHACL mapping of the TypeDB schema for RDF export (GeoSPARQL, FIBO)
- [ ] C2 drought risk score: SPI/SPEI from CHIRPS/ERA5, NDVI anomaly
- [ ] C3 parametric index backtest
- [ ] Reuse archived Sentinel-2/canopy-height work for land monitoring around properties
