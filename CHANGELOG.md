# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Changed
- Project direction: from the Genipabu vegetation-risk demo to a climate-risk platform for family farmers
- `AGENTS.md` rewritten for the new stack (PostGIS, H3, TypeDB) and LGPD rules; `CLAUDE.md` symlink added
- Git hooks moved from Lefthook to pre-commit (`.pre-commit-config.yaml`), adding ruff

### Added
- Living docs site (`docs-site/`, Astro Starlight) deployed to GitHub Pages by `.github/workflows/docs.yml`: research and design notes synced from `docs/`, the web mock embedded live at `/app/`, a screenshot gallery, decision records with interactive illustrations (weighted decision matrix, H3 resolution explorer) and Gherkin specs from `features/` rendered as pages; a Playwright smoke test checks it on every build
- `web/` builds under a sub-path (`vite build --base`), for the docs site
- Semantic layer and open data: `semantic/taxonomy.ttl` (SKOS, AGROVOC links), `semantic/ontology.ttl` (GeoSPARQL, PROV-O, LADM terms) and `tabush.semantic.publish`, which writes GeoParquet 2.0 layers, the graph as `nodes`/`edges` Parquet tables, `concepts` and `semantic_model.json` to `data/open/`
- "Ask the data" page (`/ask`): Claude turns a question into DuckDB SQL over the open files, runs it in the browser with DuckDB-WASM and explains the result with sources; worked examples without an API key
- `tabush.ingest.municipalities`: IBGE boundaries with Census 2022 total, indigenous and in-TI population
- Golden questions (`semantic/examples.json`), a synthetic fixture (`tabush.semantic.fixture`), Gherkin specs in `features/` run by playwright-bdd, and a CI workflow
- Land tenure layer: `tabush.ingest.car` (SICAR CAR records per pilot municipality, legal size class), `tabush.ingest.protected_areas` (MMA CNUC, public-domain categories per SNUC) and `tabush.risk.tenure_overlaps` (CAR × CAR, CAR × indigenous land and CAR × public protected area flags, plus traceable overlap rows with confidence); the web map shows all three in a "Land tenure" legend card
- `tabush.ingest.common`: shared data folder, snapshot and PMTiles helpers
- First public data slice: `tabush.ingest.indigenous_lands` downloads FUNAI indigenous land limits, writes a dated GeoParquet snapshot and PMTiles; the web map shows them with a layer switch, source and snapshot date
- `Switch` UI component
- `uv` project skeleton: `src/tabush/{ingest,geo,graph,risk}`, geo helpers with tests
- `schema/core.tql`: first-cut TypeDB ontology
- `docs/research/`: problem shortlist, technical requirements, unit economics and related notes
- `TODO.md` for the phase-0 pilot

### Removed
- Genipabu demo scope and TODO, moved to `archive/genipabu-demo/` (original state tagged `v0.1-genipabu`)

## [0.1.0] - 2026-09-12

### Added
- `docs/Genipabu Demo Tech Scope.md` — full technical scope for the Extremoz vegetation-risk demo
- `AGENTS.md` — project context and developer disciplines for AI agents (symlinked as `CLAUDE.md`)
- `lefthook.yml` — pre-commit hooks: large-file guard, credential leak guard, notebook output stripping
- `.gitignore` — blocks data files (GeoTIFF, NetCDF, model weights), credentials, and build artifacts
