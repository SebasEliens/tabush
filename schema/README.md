# TypeDB schema (the ontology)

`core.tql` is the first cut of the ontology from `docs/research/technical-requirements.md` §4.
It will be validated in the phase-0 TypeDB spike. Geometry stays in PostGIS; the graph holds
H3 cells, overlap results and provenance (`source`, `snapshot-date`, `confidence`).
