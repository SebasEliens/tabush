# TODO

Phase 0 (months 0–3): one pilot municipality, compliance report (C1), first ontology.
Each item maps to one atomic commit. Move items to `CHANGELOG.md` when done.

---

## Milestone 0 — Decisions and environment

- [ ] Pick the pilot municipality (family-farm heavy, co-op partner likely, good CAR coverage)
- [ ] `docker-compose.yml` with PostGIS and TypeDB 3.x Community Edition
- [ ] TypeDB spike: load `schema/core.tql`, insert sample data, test multi-hop queries and LLM text-to-TypeQL; decide TypeDB vs Neo4j

## Milestone 1 — Ingest (one module per source in `src/tabush/ingest/`)

- [ ] SICAR/CAR property boundaries and status for the pilot municipality
- [ ] INCRA SIGEF land titles
- [ ] Territories: FUNAI indigenous lands, INCRA quilombolas and settlements, CNUC protected areas, SFB CNFP public forests
- [ ] IBAMA embargoes (+ state list if available) and MTE *lista suja*
- [ ] MapBiomas land use and Alerta; INPE PRODES/DETER
- [ ] Each source: provenance columns, CRS guard, validity check, dated GeoParquet snapshot, load to PostGIS

## Milestone 2 — Overlaps and graph

- [ ] PostGIS overlap queries: property × territory, property × embargo, property × deforestation, CAR × SIGEF (IoU)
- [ ] H3 indexing of parcels (res 9)
- [ ] Load entities and overlap relations into the graph with `source`, `snapshot_date`, `confidence`
- [ ] Flag duplicate/suspicious CAR overlaps

## Milestone 3 — Compliance report (C1)

- [ ] `POST /checks`-style function: CAR code → pass/flag report with evidence
- [ ] Report output (HTML/PDF) with map and source citations for each flag
- [ ] Hand-label a sample to measure property-to-record link precision (target ≥95%)

## Backlog

- [ ] Dagster orchestration once more than two sources are ingested
- [ ] OWL/SHACL mapping of the TypeDB schema for RDF export (GeoSPARQL, FIBO)
- [ ] C2 drought risk score: SPI/SPEI from CHIRPS/ERA5, NDVI anomaly
- [ ] C3 parametric index backtest
- [ ] Reuse archived Sentinel-2/canopy-height work for land monitoring around properties
