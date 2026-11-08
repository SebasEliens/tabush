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

## Design notes

- **Vendor agnostic.** The image is a plain static bundle on nginx (non-root,
  port 8080, `/healthz`). It runs on any container platform or static host.
- **Runtime config, not build-time.** `TABUSH_API_URL` and
  `TABUSH_MAP_STYLE_URL` are written to `/config.js` when the container
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

Stack: React 19, TypeScript, Vite, MapLibre GL, React Router, lucide icons,
Inter + Outfit (self-hosted).
