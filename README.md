# Tabush

A rural property knowledge graph and climate-risk platform for Brazilian family farmers.
It combines open registry data (CAR, SIGEF, territories, embargoes), satellite-derived land use
and climate data to give credit co-ops, banks and insurers:

- **C1** compliance checks per property or borrower
- **C2** drought, flood and heat risk scores per property and portfolio
- **C3** parametric insurance indices with backtests and automatic payout events

The aim is to make credit and insurance cheaper and fairer for climate-exposed family farmers.
See [`docs/research/`](docs/research/) for the problem framing, unit economics and
[technical requirements](docs/research/technical-requirements.md).

## Layout

```
src/tabush/
  ingest/   source downloaders and validators (one module per source)
  geo/      CRS conventions, geometry checks, H3 indexing
  graph/    TypeDB loading and queries
  risk/     compliance checks, risk scores, parametric indices
schema/     TypeDB schema (the ontology)
notebooks/  exploration (outputs stripped on commit)
tests/
docs/research/  design and market research
archive/    retired earlier work (Genipabu vegetation-risk demo)
```

## Setup

```bash
uv sync                    # create .venv and install dependencies
uvx pre-commit install     # install git hooks
cp .env.example .env       # then fill in connection settings
uv run pytest
```

Agent and contributor conventions are in [`AGENTS.md`](AGENTS.md).
