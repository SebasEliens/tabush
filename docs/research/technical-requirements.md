# Technical requirements: climate-risk platform for family farmers

*Draft v0.1 · 17 Oct 2026 · companion to [problem-space-shortlist.md](problem-space-shortlist.md) and [unit-economics-family-farm-risk.xlsx](unit-economics-family-farm-risk.xlsx)*

## 1. What the system must do (MVP scope)

| # | Capability | Customer | Output |
|---|-----------|----------|--------|
| C1 | **Compliance check** for a rural property / borrower | Credit co-ops, banks | Pass/flag report: CAR status, IBAMA/state embargoes, overlaps with indigenous lands, quilombola territories, protected areas, undesignated public forest, recent deforestation, *lista suja* |
| C2 | **Climate-risk score** per property and per portfolio | Lenders, insurers | Drought / flood / heat exposure, expected yield loss, concentration risk across a portfolio |
| C3 | **Parametric index engine** | Insurer (risk carrier), co-ops | Index definition, trigger calibration, backtest, daily index values, automatic payout events |
| C4 | **Adaptation verification (MRV)** | Climate / development funds, lenders | Evidence that a practice (agroforestry, irrigation, cover crops) exists and persists, with imagery |
| C5 | **Monitoring & alerts** on active loans/policies | Lenders, insurers | Crop status, new deforestation, hazard events |
| C6 | **Analyst Q&A** over the graph | Internal team, co-op credit officers | Natural-language answers with citations to underlying records |

The **rural property knowledge graph** underpins all six, and it's also what the supply-chain product (#2 on the shortlist) would reuse.

## 2. Data sources

| Domain | Source | Format / access | Cadence |
|-------|--------|-----------------|---------|
| Property boundaries | **SICAR / CAR** (rural environmental registry) | Shapefile downloads per municipality/state; status via consulta pública | Continuous; snapshot monthly |
| Land titles | **INCRA SIGEF / SNCI**, state land agencies | Shapefile / WFS | Monthly |
| Territories | **FUNAI** indigenous lands, **INCRA** quilombolas & settlements, **ICMBio/CNUC** protected areas, **SFB CNFP** public forests | Shapefile / WFS | Quarterly |
| Deforestation & land use | **INPE PRODES / DETER**, **MapBiomas** (annual collections, Alerta, fire, water) | GeoTIFF / vector, GEE assets, APIs | DETER daily; MapBiomas annual |
| Enforcement | **IBAMA embargoes**, state embargo lists, MTE *lista suja* | CSV / shapefile / PDF | Weekly–monthly |
| Agro-climatic risk | **ZARC** (MAPA/Embrapa), **IBGE PAM** municipal yields, **Censo Agro 2017** | Tables / API | Annual |
| Weather & climate | **INMET** stations, **CEMADEN** gauges, **CHIRPS** (1981–), **ERA5-Land**, **SMAP** soil moisture, **CMIP6** downscaled projections | NetCDF / COG / API | Daily (near-real-time) + historical |
| Satellite imagery | **Sentinel-2** (optical), **Sentinel-1** (radar, works through clouds), **Landsat**; commercial (Planet) optional | COG via STAC (e.g. Microsoft Planetary Computer, AWS Open Data) | 5–12 days |
| Credit & insurance | **BCB SICOR** (aggregated rural credit), **PSR/Proagro** claims stats, **partner co-op loan books & claims** (private, under contract) | CSV / API | Monthly |
| Companies & people | Receita Federal CNPJ open data; CPF only from partners with consent | CSV | Monthly |

**Critical private data:** co-op loan performance and insurance claims history. Without it, the C2 risk score cannot be calibrated, so data-sharing terms belong in every pilot contract.

## 3. Architecture

```
 Sources ──► Ingestion & validation ──► Geospatial lakehouse ──► Feature & model layer ──► Knowledge graph ──► APIs / apps
 (open +      (Dagster/Airflow,          (object storage:          (raster pipelines,         (Neo4j or RDF     (REST API, batch,
  partner)     schema + geometry checks)  GeoParquet + COG,        ML models, index engine)   store + ontology)  web app, WhatsApp)
                                          STAC catalog, PostGIS)
```

- **Orchestration:** Dagster (or Airflow), with each data source as a versioned asset. Every run stores a dated snapshot so any past report can be reproduced exactly (needed for audits and insurance disputes).
- **Storage:** object storage with GeoParquet (vectors) and Cloud-Optimized GeoTIFF/Zarr (rasters), catalogued in **STAC**. **PostGIS** holds the source-of-truth geometry and runs overlap queries.
- **Raster processing:** Python open stack (xarray, Dask, odc-stac, rasterio). Google Earth Engine is fine for prototyping, but production shouldn't depend on it because of licensing and auditability.
- **Spatial index:** **H3** hexagons (resolution ~8–9) as the join key between rasters, polygons and the graph, so graph queries never have to do heavy geometry.
- **Knowledge graph (updated 17 Oct, Sebas prefers TypeDB):** **TypeDB 3.x** is the preferred option. Its typed schema (entity/relation/attribute types, inheritance, n-ary relations with attributes, cardinality and value constraints, functions for derived facts) *is* the ontology, so there's no separate OWL layer to keep in sync. Caveats: no native geospatial types, so geometry stays in PostGIS and the graph stores H3 cells and overlap results as attributes; no built-in RDF/OWL export, so a mapping to GeoSPARQL/FIBO is needed for partners who want RDF; fewer graph algorithms than Neo4j GDS; LLMs are weaker at writing TypeQL than Cypher/SPARQL, so the Q&A layer needs few-shot examples or query templates; Community Edition is single-server (MPL 2.0), and HA needs Cloud/Enterprise, so a Brazil-hosted deployment needs confirming. Validate in the phase-0 spike. Fallback: a property graph (**Neo4j**) for fast multi-hop operational queries. The ontology is maintained in OWL with **SHACL** shapes for validation and mapped into the graph (e.g. neosemantics), so RDF export stays possible for partners and auditors. GraphDB/Stardog is the alternative if RDF/SPARQL interoperability turns out to matter more than query speed.
- **Hosting:** a Brazil region (e.g. AWS sa-east-1 or GCP southamerica-east1) for LGPD and partner comfort.

## 4. Ontology

Core classes and relations (first cut):

- `RuralProperty` (CAR code) —`hasParcel`→ `Parcel` (geometry) —`overlaps{area, pct}`→ `Territory` {IndigenousLand, Quilombola, ProtectedArea, PublicForest, Settlement}
- `Parcel` —`titledAs`→ `LandTitle` (SIGEF/SNCI)
- `Person` / `LegalEntity` (hashed CPF / CNPJ) —`owns|operates|memberOf`→ `RuralProperty`, `Cooperative`
- `Loan` / `InsurancePolicy` —`securedBy|covers`→ `RuralProperty`; `issuedBy`→ `FinancialInstitution`
- `Embargo`, `DeforestationEvent`, `HazardEvent` —`affects`→ `Parcel`, with time
- `Practice` (adaptation) —`observedOn`→ `Parcel`, `evidencedBy`→ `Observation`
- `Crop`, `Season`, `ZarcRiskClass`, `Municipality` (IBGE code), `Basin`

**Reuse instead of inventing:** GeoSPARQL (geometry), SOSA/SSN (observations and sensors), PROV-O (lineage of every derived fact), OWL-Time, FIBO (loans, contracts), AGROVOC (crops, practices). Every edge carries `source`, `snapshotDate` and `confidence`, so each flag in a report can be traced to its record.

## 5. Entity resolution (the hard part)

- **Polygons:** CAR records overlap each other and SIGEF titles. Match by intersection-over-union plus temporal logic, and flag duplicates and suspicious overlaps (a known land-grabbing signal).
- **People/companies:** probabilistic matching on hashed IDs, names and municipality (e.g. Splink). Partner-supplied CPF is hashed at ingestion.
- **Target:** ≥95% precision on property-to-borrower links in the pilot municipality, verified against a hand-labelled sample.

## 6. AI / ML components

| Model | Approach | Ground truth / validation |
|-------|----------|---------------------------|
| Land use & deforestation | Consume MapBiomas/PRODES first; own Sentinel-2/1 change detection only where finer or faster detection pays off | MapBiomas validation points, field visits |
| Crop type & phenology | Time-series classifier (e.g. temporal CNN/transformer, or a fine-tuned geospatial foundation model such as Prithvi) on Sentinel-2 + Sentinel-1 | Co-op crop declarations, IBGE PAM |
| Drought / flood hazard | Indices: SPI/SPEI from CHIRPS/ERA5, soil moisture anomaly, NDVI/EVI anomaly; flood from Sentinel-1 water extent + HAND model | Historical disaster declarations (S2iD), CEMADEN |
| Yield-loss model | Gradient-boosted model linking hazard indices to yield, by crop and region | IBGE PAM municipal yields, partner harvest data, Proagro/PSR claims |
| Credit default model | Hazard + farm features + co-op history; must stay explainable (monotonic constraints, SHAP) | Partner loan books |
| Parametric triggers | Index choice and threshold optimization that minimizes **basis risk** (index says "no loss" when the farmer lost) | 20–40 year backtest, partner claims |
| Analyst Q&A (LLM) | Text-to-Cypher/SPARQL over the graph with retrieval of source documents; answers must cite records; read-only access | Curated question set with expected answers |

Fairness requirement: the credit score must be tested so it doesn't systematically exclude the most climate-exposed regions. The product should output an **adaptation pathway** (what would improve the score) alongside any decline.

## 7. Parametric index engine (C3) specifics

- Index definitions are versioned and immutable once a policy is sold (data source, cell/area, window, threshold, payout curve).
- Index values come from published, reproducible feeds (e.g. CHIRPS/ERA5 plus a fallback source), with documented rules for missing data.
- Backtest report per product: historical payout frequency, loss ratio, basis-risk estimate.
- Payout events are generated automatically and pushed to the insurer, with farmer notification over WhatsApp/SMS.
- Must fit SUSEP rules for parametric products and the insurer's actuarial sign-off. The insurer files the product; we provide the technical note and data.

## 8. Interfaces

- **REST API:** `POST /checks` (property or CAR code → compliance report), `GET /risk/{property}`, `POST /portfolio/score`, index and payout webhooks. Plus batch CSV/SFTP for co-ops without IT teams.
- **Web app** for credit officers: map view, report PDF with evidence imagery, portfolio dashboard.
- **Farmer channel:** WhatsApp for alerts and payout notices (most family farmers use WhatsApp; few use apps).
- Integration with co-op core banking systems is likely custom per co-op system at first, and is a known cost driver.

## 9. Non-functional requirements

- **LGPD:** personal data minimized and hashed, consent captured via the partner, a named DPO, data processing agreements, and Brazil data residency.
- **Auditability:** every report reproducible from a dated data snapshot, with model and index versions logged (PROV-O lineage). Needed for Central Bank social-environmental-climate risk rules, model-risk reviews and insurance disputes.
- **Performance:** a cached compliance check in under 5 s; a fresh property analysis in under 2 min; portfolio scoring of 10k properties in under 1 h.
- **Availability:** 99.5% for the API; the index feed has a fallback source.
- **Security:** SSO for partners, role-based access per institution (a co-op sees only its members), encryption at rest and in transit, SOC 2-style controls by year 2.

## 10. Build plan

| Phase | Scope | Team (FTE) |
|-------|-------|------------|
| 0–3 months | One pilot municipality: ingest CAR, SIGEF, territories, embargoes, MapBiomas into PostGIS + graph; C1 compliance report; first ontology | 4–5 (2 data/geo eng, 1 data scientist, 1 full-stack, founder/product) |
| 3–9 months | C2 drought risk score + C3 index backtest with one insurer and one co-op; first paid pilot; REST API | 8 (adds actuarial/insurance lead, ML engineer, partner success) |
| 9–18 months | Multi-state coverage, C4 MRV, C5 alerts, WhatsApp channel, LLM analyst Q&A, security certification | 14 |

This headcount matches the unit-economics model (8 FTE in year 1, 14 in year 2).

## 11. Key technical risks

1. **CAR data quality:** self-declared, overlapping, often outdated boundaries. Mitigate by fusing with SIGEF and imagery, and by surfacing confidence scores.
2. **No claims or loan history:** risk models stay uncalibrated. Mitigate by making data sharing a pilot condition, and by using IBGE PAM yields as a proxy.
3. **Basis risk** in parametric products erodes farmer trust. Mitigate with finer indices (soil moisture, crop-specific windows) and transparent backtests.
4. **Cloud cover** in the North and Northeast rainy seasons. Mitigate with Sentinel-1 radar.
5. **Integration cost** with co-op systems. Start with batch files and a web app before API integrations.
