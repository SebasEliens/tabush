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
