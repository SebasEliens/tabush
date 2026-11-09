---
name: design-system
description: Use when building or changing any UI in web/ (pages, components, styles, map styling, copy). Applies Tabush's human-centred design process, UI principles, tokens and components, and the verification steps for a UI change.
---

# Tabush design system

Read `docs/design-system.md` first; it is the source of truth. This skill is
the working procedure.

## Before you design
1. Name the user and the decision the screen supports (default user: a co-op
   credit officer deciding on a rural loan). Write it in the PR description.
2. Check `docs/design-feedback.md` for earlier feedback on the same screen.

## While building
- Use components from `web/src/ui` (`Button`, `StatusBadge`, `Callout`, `Card`,
  `Stat`, `Meter`, `SegmentedControl`, `Disclosure`, `SearchInput`, `Select`,
  `EmptyState`, `Skeleton`, `Landscape`, `Logo`). Extend them instead of
  writing one-off markup.
- Style with semantic tokens from `web/src/design/tokens.css` only. Never
  use raw hex values or primitives (`--green-600`) in components or pages. If
  a JS value is needed (MapLibre paint), import it from `design/tokens.ts` and
  keep it in sync with the CSS.
- Spacing on the 4px grid (`--space-*`); use `stack-*` and `row` utilities.
- Hierarchy: one display-font title per view; inside a panel use the order
  identity → verdict → risk → actions → details.
- Progressive disclosure: summary first; secondary detail in `Disclosure`.
- Status is always icon + word via `statusTone`/`statusText` from
  `src/format.ts`. Scores always get a word via `riskLevel`.
- Copy: plain language, sentence case, lead with the decision, show source
  and snapshot date for every finding.
- Orange (`--color-spark`) is decoration only, never status.
- Illustration (`Landscape`) is for brand moments, never inside data views.
- Accessibility: keyboard reachable, visible focus (`:focus-visible` ring),
  ARIA roles for custom controls, respect `prefers-reduced-motion`.
- New reusable pattern? Add it to `web/src/ui` **and** to the `/design`
  gallery (`src/pages/DesignPage.tsx`), and document it in
  `docs/design-system.md`.

## Verify before pushing
```sh
cd web
npm run build            # type check + bundle
npm run check:contrast   # WCAG AA for semantic colour pairs (edit the pair list when adding tokens)
```
Then run the app (`npx vite preview --port 8080` after a build, or
`docker compose up --build`) and take Playwright screenshots of each changed
screen at 1440x900, deviceScaleFactor 2. Look at them yourself; check
hierarchy, alignment, spacing and that nothing overlaps. Attach them to the
PR or the thread.

## After feedback
Add a row to `docs/design-feedback.md` (date, who, screen, feedback,
response/PR). Prefer fixing at the token or component level so the change
propagates.
