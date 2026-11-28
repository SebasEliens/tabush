# tabush web (frontend mock)

Clickable mock of the credit-officer web app: map of rural properties with
climate risk and compliance colouring, a property panel (compliance check,
hazard scores, loans), portfolio dashboard, alerts feed, and a printable
compliance report. All data is fake and generated in the browser
(`src/api/mock/`), around Canguçu (RS).

## Run

```sh
docker compose up --build              # production build on http://localhost:8080
docker compose --profile dev up        # Vite hot reload on http://localhost:5173
# or without Docker
cd web && npm install && npm run dev
```

## Public data layers

Real public land-tenure layers are drawn on the map, each with a
switch, source and snapshot date in the "Land tenure" legend card. As soon as
any of them is built, the map page drops the fake portfolio (parcel grid,
property list and side panel) and shows only real data; the mock stays as a
fallback when no layer exists. Every panel on the map folds to its title, and
"Hide panels" (or the H key) clears them all.

Build the tiles from the repo root, in this order (the CAR step measures overlaps against
the first two):

```sh
uv run python -m tabush.ingest.indigenous_lands   # FUNAI limits via IBGE, ~1 min
uv run python -m tabush.ingest.protected_areas    # MMA CNUC, ~1 min
uv run python -m tabush.ingest.car                # CAR for Canguçu (RS), ~1 min
uv run python -m tabush.ingest.car --municipio 4304507 --municipio 1507300  # + São Félix do Xingu (PA)
```

| Layer | Source | Shown as |
|---|---|---|
| Rural properties (CAR) | SICAR public WFS | Outline; red fill if it overlaps an indigenous land or a protected area that must be public land, amber if 20%+ overlaps another CAR claim |
| Indigenous lands | FUNAI limits via IBGE Census 2022 | Dashed purple |
| Protected areas | MMA CNUC register | Teal; stronger fill where the law requires public land |

The app reads `<layer>.pmtiles` and its provenance file `<layer>.json` from
`TABUSH_TILES_URL` (default `/tiles`). Vite and the compose services serve
`data/tiles/` there; in the cloud it will be object storage plus a CDN in a
Brazil region. A layer whose tiles are missing says so in the legend, and the
rest of the app works as before.

## Ask the data

`/ask` answers questions about the open land tenure data in plain Portuguese or English.
DuckDB-WASM queries the published files in the browser; Claude writes the SQL, guided by
the taxonomy and ontology in `semantic/`, and the page shows every query, its result and
the sources. Design: [docs/research/talk-to-the-data.md](../docs/research/talk-to-the-data.md).

```sh
uv run python -m tabush.ingest.municipalities --municipio 4304507 --municipio 1507300
uv run python -m tabush.semantic.publish     # after the land tenure ingests above
echo "ANTHROPIC_API_KEY=..." >> ../.env       # optional; without it only worked examples run
npm run dev
```

The Vite dev and preview servers proxy `/llm` to the Claude API and add the key, so it
never reaches the browser. The nginx image has no proxy yet: point `TABUSH_LLM_URL` at an
LLM gateway, or leave it empty for worked examples only. Open data is read from
`TABUSH_OPEN_DATA_URL` (default `/open`, served from `data/open/`).

### Tests

The behaviour is specified in [`../features/`](../features/) and run with
[playwright-bdd](https://vitalets.github.io/playwright-bdd/):

```sh
npm run e2e:data   # synthetic fixture in data/e2e/open (no network)
npm run e2e        # scenarios with a stubbed assistant; screenshots in e2e/screenshots/
npm run e2e:llm    # @llm golden questions against the real model (needs ANTHROPIC_API_KEY)
```

## Design notes

- **Vendor agnostic.** The image is a plain static bundle on nginx (non-root,
  port 8080, `/healthz`). It runs on any container platform or static host.
- **Runtime config, not build-time.** `TABUSH_API_URL`,
  `TABUSH_MAP_STYLE_URL` and `TABUSH_TILES_URL` are written to `/config.js` when the container
  starts, so one image serves every environment.
- **API contract first.** `src/api/types.ts` defines the `TabushApi`
  interface the backend will implement; `src/api/mock/` is a stand-in.
  An empty `TABUSH_API_URL` selects the mock.
- **Basemap.** Defaults to OpenStreetMap raster tiles; point
  `TABUSH_MAP_STYLE_URL` at any MapLibre style (e.g. self-hosted PMTiles).
- **Multi-tenancy.** The institution switcher shows that each tenant only
  sees its own properties, loans and alerts.

## Design system

Tokens live in `src/design/`, components in `src/ui/`, and the live gallery
is at `/design`. Principles and rules are in
[docs/design-system.md](../docs/design-system.md), and feedback is logged in
[docs/design-feedback.md](../docs/design-feedback.md). Agents follow
`.claude/skills/design-system/SKILL.md`.

```sh
npm run check:contrast   # WCAG AA check of semantic colour pairs
```

Stack: React 19, TypeScript, Vite, MapLibre GL, PMTiles, React Router, lucide icons,
Inter + Outfit (self-hosted).
