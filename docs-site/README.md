# Tabush living docs

Static, interactive docs on GitHub Pages: <https://sebaseliens.github.io/tabush/>.
Built with [Astro Starlight](https://starlight.astro.build); see
[decision 0001](src/content/docs/decisions/0001-docs-site-starlight.mdx) for why.

| Content | Source of truth |
|---|---|
| Research and design notes | `../docs/**/*.md`, synced by `scripts/sync-docs.mjs` (do not edit the copies) |
| Screenshots | `../docs/screenshots/<slice>/`, shown in the Mocks gallery |
| Specs | `../features/*.feature`, rendered on "Specs and evidence" |
| Live mock | `../web`, built into `dist/app/` with its in-browser mock API |
| Pages, decision records | `src/content/docs/**/*.mdx` |
| Interactive widgets | `src/components/` (React islands, hydrated with `client:visible`) |

```sh
npm install
npm run dev            # http://localhost:4321/tabush/ (no live mock in dev)
npm run build:all      # site + web mock into dist/
npm run screenshots    # Playwright smoke test of the built site, writes screenshots/
```

The theme imports `../web/src/design/tokens.css`, so colours and fonts follow
the app's design system. Deploys run from `.github/workflows/docs.yml` on every
push to `main`; pull requests build and test only.
