# Review: "Icebergs, Maps, and Where We Can Go With Spatial Data Lakes"

*Research note · 9 Nov 2026 · companion to [technical-requirements.md](technical-requirements.md) and [web-app-stack-proposal.md](web-app-stack-proposal.md)*

**Source:** David G. Smith, *Icebergs, Maps, and Where We Can Go With Spatial Data Lakes*, 6 Nov 2026 (~7 min read). [Link](https://davidgsmith.net/thoughts/icebergs-maps-and-where-we-can-go-with-spatial-data-lakes.html). It follows his October piece on Portolan.

## Bottom line

It's a short opinion piece, not a technical guide. It names no versions, says nothing about spatial partitioning, H3/S2 or performance, and flags almost no limitations. Its value for us is a clear **division of labour** for a cloud-native geodata stack, which mostly confirms what we already planned. It adds one idea worth adopting: **Iceberg tables for the versioned vector snapshots**, discoverable through STAC. **It doesn't change the architecture.** At most it adds one layer to the lakehouse, and that can wait until phase 1.

## Key ideas

- **"What if the files themselves were enough?"** Publishing geodata used to mean servers, databases, APIs and permissions. The cloud-native alternative is plain files in object storage plus open metadata.
- **One job per component:**
  - STAC says *what exists*.
  - GeoParquet (vectors), COG (rasters) and PMTiles (tiles) make the data *efficient*.
  - DuckDB (also Spark, BigQuery, PyIceberg) makes it *queryable*.
  - Apache Iceberg makes it *durable and versioned*: "Files are wonderful for distribution. Tables are wonderful for evolution."
  - **Portolan** (portolan-sdi.org) is a serverless spatial-data-infrastructure spec and CLI that makes a STAC catalog of files *publishable and understandable*.
- **STAC Iceberg Extension** (github.com/portolan-sdi/stac-iceberg-extension, still in development) adds Iceberg table metadata to STAC Collections. Clients can find a table in the catalog and open it straight from DuckDB, Spark or PyIceberg.
- **Agents need open catalogs.** "Agents don't care what vendor's portal you're running." Machine-readable catalogs plus versioned tables become "a machine-readable knowledge layer for the physical world." STAC brings "cognitive interoperability", not just technical interoperability.

## What it means for Tabush

**1. It confirms our storage choices.** We already have GeoParquet + COG/Zarr in object storage, a STAC catalog (pgstac), and PostGIS for overlap queries. Smith's stack is the same, minus PostGIS. We keep PostGIS: the compliance check (C1) is a set of polygon-overlap queries with a <5 s target, and that is a database job, not a file-scan job.

**2. Iceberg solves our reproducibility requirement more cleanly than dated folders.** The requirements say every report must be reproducible from a dated snapshot (Central Bank rules, insurance disputes). Today that means one GeoParquet folder per source per `snapshot_date`. An Iceberg table per source (`car_properties`, `ibama_embargoes`, `sigef_parcels` …) gives the same thing with less bookkeeping:
- each monthly Dagster run commits a new **snapshot**, and a report stores the snapshot ID it used, which is exact, auditable lineage that fits our PROV-O model;
- **time travel** answers "what did the embargo list say on the day this loan was approved?";
- **schema evolution** absorbs the frequent column changes in SICAR and IBAMA exports;
- row-level **deletes/upserts** handle records that are corrected or withdrawn.

*(My additions, not from the article; check current versions before relying on them:)* Iceberg format v3 added native `geometry`/`geography` types, and Parquet now has matching logical types, so the GeoParquet/Iceberg split is narrowing. Engine support for the v3 geo types (PyIceberg, DuckDB, Sedona) is still uneven, so the safe pattern today is WKB geometry columns plus an **H3 cell column used as the partition/sort key**, which matches our spatial join key.

**3. Rasters stay as COG/Zarr in STAC.** The article doesn't propose Iceberg for rasters and neither should we. Versioning for rasters (MapBiomas collections, CHIRPS) is handled by immutable, dated STAC items.

**4. DuckDB is a good analytics engine next to PostGIS.** With its spatial and Iceberg extensions, DuckDB can run portfolio scoring and backtests (C2/C3) straight off the lake without loading PostGIS. That keeps PostGIS small and focused on serving.

**5. Opening the catalog to partners and agents.** A STAC catalog that points to Iceberg tables (via the extension) is a cheap way to give insurers, auditors and our own LLM Q&A agent (C6) a discoverable, read-only view of the *public* layers. **Partner data (loan books, claims, hashed CPF) must never go into an open catalog**, so the catalog needs a public tier and a private, tenant-scoped tier.

**6. Portolan: watch, don't adopt.** It's young, it doesn't handle mixed open/private data well yet (see the maintainer comment below), and its focus (publishing public SDI data) isn't our core need. It could matter later if we publish derived open layers (e.g. a municipal climate-risk layer) as a public good, which also supports the climate-justice side.

## Reader comment from a Portolan maintainer

A comment on the article (shared by Sebas 9 Nov; the author writes as one of Portolan's founders) adds two points the article leaves out:

- **Iceberg geo support isn't mature yet.** "If Iceberg was more mature (in general, and more specifically the geo support) when we started Portolan then I'm sure it would have been in the core." Portolan is built on GeoParquet for that reason, and the founders see Iceberg as a future upgrade, with Parquet kept as an option. This supports our plan to **stay on dated GeoParquet in phase 0** and treat Iceberg as a phase-1 upgrade once geo support in the engines is solid.
- **Mixed open/private access is a known gap.** "Portolan today is good for fully open data, or data fully behind a firewall, but less so for 'both'." That is exactly our case: public layers (CAR, embargoes, territories) next to tenant-private partner data. So Portolan can't be the catalog layer for our public/private split today. We need our own access control (e.g. tenant-scoped STAC in pgstac plus Iceberg catalog permissions). They hope Iceberg will help here, which is worth tracking.

## Related product: LakehouseBox

*Checked 10 Nov 2026 from [lakehousebox.com](https://lakehousebox.com/) (shared by Sebas). Everything here is the vendor's own claims, and none of it has been tested.*

**What it is:** a managed Apache Iceberg service "for AI agents", run by Lakehousebox S.L. (Madrid). It bundles these parts in one "store" container:
- an Iceberg REST catalog (their own build)
- S3-compatible storage
- scheduled SQL and hosted agents
- MCP access for agents
- public catalogs served over a CDN
- a Postgres endpoint (pg_lake) for BI tools

It can be read and written from DuckDB, Spark, Trino, Polars and PyIceberg.

**Price:** €0.10/GB-month for storage and €0.12/CPU-hour for compute, with no egress fees. Queries run in your own engine aren't billed.

**Self-hosting:** one node on Docker Compose, under a commercial licence. There's no Kubernetes option.

**What lines up with this review:**
- **Iceberg v3 geometry columns**, GeoParquet import and automatic spatial clustering. This is the "Iceberg for geo" upgrade the Portolan maintainer was waiting for, offered as a product.
- **Public catalogs next to private ones.** Credentials are scoped to a catalog, last one hour, and come with read/write per person or key. Enterprise adds per-table grants, OIDC and a 400-day audit log. This targets the mixed open/private gap that Portolan has.
- **Agent access via MCP** fits our analyst Q&A component (C6) and the article's "agents need open catalogs" point.

**Why it doesn't fit as our core platform:**
- **Data residency.** The managed service runs in Frankfurt and Stockholm. Our rule is to keep data in a Brazil region (LGPD, and what partners expect), so the managed service is out for partner data. Self-hosting in sa-east-1 would solve that.
- **Self-hosting is too thin for production.** It's a single node, with no high availability and no Kubernetes. That is weaker than our 99.5% API target and than a standard Iceberg catalog setup.
- **Closed source and very new.** Its GitHub repo holds only an issue tracker: 0 stars, 2 commits, no releases. There's no security certification, and no licence terms are published. Our audit requirements and the risk of lock-in argue against a young closed vendor at the centre of the data layer.
- **Gaps.** PyIceberg can't write v3 tables yet, which matters because Dagster ingest would use PyIceberg. The site doesn't say how it handles CRS or geography types. Dagster isn't mentioned, and its own scheduler overlaps with ours.

**Verdict: use it as a benchmark, not as our platform.** It's a useful reference for what a geo-aware Iceberg catalog with scoped access looks like. We won't trial it (decided 11 Nov). For the core platform we stay on open components we can host in Brazil:
- PyIceberg/DuckDB
- an open REST catalog (Lakekeeper or Polaris, on Postgres)
- S3 in sa-east-1
- pgstac

## Suggested changes

| Area | Change | When |
|---|---|---|
| technical-requirements §3 | Add Apache Iceberg (via PyIceberg, REST catalog) as the table format for versioned vector snapshots; H3 as partition key | Phase 1 (phase 0 can stay with dated GeoParquet) |
| Ontology / PROV-O | Record `iceberg_snapshot_id` alongside `snapshot_date` on derived facts | When Iceberg lands |
| Stack proposal | Add DuckDB (spatial + iceberg extensions) as the batch/analytics engine | Phase 1 |
| Catalog | Split STAC into public and tenant-private tiers; track the STAC Iceberg Extension | Phase 1–2 |

## Open questions

- Which Iceberg catalog to run in a Brazil region (REST catalog on Postgres, Lakekeeper, Polaris, or AWS Glue in sa-east-1)?
- Is the extra layer worth it for a 4–5 person phase-0 team, or should we only adopt it when reproducibility audits start?
