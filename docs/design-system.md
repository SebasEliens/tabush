# Tabush design system

The web app's visual language and the rules behind it. The live reference
is the `/design` route in the running app (palette icon in the top bar).
Code lives in `web/src/design/` (tokens, base styles) and `web/src/ui/`
(components).

## 1. How we design: human-centred design

We follow the four human-centred design principles and its iterative loop.
Users are credit officers at co-ops and banks, and later insurers and
farmers. Until real users are available, Sebas plays the user and his
feedback is logged in [design-feedback.md](design-feedback.md).

| HCD principle | What it means in Tabush |
|---|---|
| **People-centred** | Design for a credit officer deciding on a loan, often in a hurry, not for a GIS analyst. Use their words: "blocked", "needs a closer look", not internal flag codes. |
| **Find the right problem** | The job is "can I lend to this farm, and how risky is it?" Every screen answers that first. Maps and scores are evidence, not the answer. |
| **Think of everything as a system** | A verdict in the panel, a row in the portfolio, an alert and the PDF report use the same words, colours and icons for the same thing. |
| **Small and simple interventions** | Ship small changes, look at them in the running app, collect feedback, iterate. Prefer adjusting a token or a component over one-off styling. |

Process for each change (observe → ideate → prototype → feedback → iterate → implement):
1. Write down whose problem it is and what decision it supports.
2. Prototype in the mock app on fake data.
3. Screenshot it, get feedback, log it in `design-feedback.md`.
4. Iterate, then promote anything reusable into a token or component.

## 2. UI principles (applied)

| Principle | Rule in this codebase |
|---|---|
| **Hierarchy** | One display-font title per view. Order inside a panel: identity → verdict → risk → actions → details. Key figures use `Stat`. |
| **Progressive disclosure** | Summary first; details, sources and secondary data go in `Disclosure`. The empty panel tells the user what to do next. |
| **Consistency** | Only tokens and `web/src/ui` components. One status vocabulary everywhere: Blocked / Review / Clear (`statusText`, `statusTone` in `format.ts`). |
| **Contrast** | Colour carries meaning. Neutral surfaces, with the brand green for primary actions only. The orange "spark" is decoration, never status. |
| **Accessibility** | WCAG AA for every colour pair (`npm run check:contrast`), status never by colour alone (icon + word), visible focus rings, keyboard reachable controls, `prefers-reduced-motion` respected, a skip link. |
| **Proximity** | Related facts sit together (a finding with its source and date; a loan with its maturity). Use `stack-*` spacing rather than ad-hoc margins. |
| **Alignment** | 4px spacing grid (`--space-*`). Numbers right-aligned with tabular figures (`.num`). |

Pro tips we adopt: guide the eye in reading order (perspective), clear
feedback on every action (copy shows a check, hover highlights a parcel),
shortcuts for frequent tasks (`/` focuses search, arrow keys in segmented
controls, Esc clears search), and testing with real use (screenshots in
every UI PR).

## 3. Visual language

Inspired by flat, grainy landscape illustration (reference: Element
Markets hero) and by environmental sites that pair earthy greens with
generous whitespace and bold type. Our own take: a southern-Brazil family
farm with an araucária pine.

- **Colour.** Deep pasture greens (brand), a bright cyan sky (highlight,
  info, focus), a solid sky-cyan brand bar with ink text (`--color-brand-bar`) for the top bar and report header, the same cyan for primary actions (`--color-action`), ink-dark green for other inverse surfaces, small
  orange sparks (logo dot, sun, roofs). Status uses red, amber, green and
  cyan tints. Climate risk uses a sequential yellow-to-red ramp, used only
  for data.
- **Type.** *Outfit* (bold, rounded geometric) for the brand, page titles,
  panel titles and key figures. *Inter* for everything that is read or
  scanned. Both are self-hosted via npm (no font CDN).
- **Shape.** Soft radii (6/10/16px), light shadows, cards on a pale
  neutral background.
- **Illustration.** `Landscape` is a decorative SVG with a grain filter. Use it
  for brand moments only (welcome panel, page heroes, the report header) and
  never inside data views.
- **Icons.** `lucide-react`, 16px in UI, 14px in small controls.
- **Map.** Desaturated basemap so data colours stand out; parcels use the
  risk ramp or status colours; selection is ink with a cyan inner line;
  territories are dashed purple.

## 4. Tokens

Defined in `web/src/design/tokens.css`. Components use **semantic**
tokens (`--color-accent`, `--color-danger-bg`, `--space-4`), never the
primitive palette (`--green-600`). Values needed in JavaScript (MapLibre
paint) are mirrored in `tokens.ts`; keep both in sync.

| Group | Tokens |
|---|---|
| Colour | `--color-bg/surface/surface-sunken/surface-inverse`, `--color-text/-secondary/-muted/-inverse`, `--color-accent/-hover/-subtle/-text`, `--color-highlight`, `--color-spark`, `--color-focus`, `--color-{danger,warning,success,info}{,-bg,-border,-text}`, `--color-territory`, `--risk-1…5` |
| Type | `--font-display`, `--font-sans`, `--font-mono`, `--text-xs…3xl`, `--weight-*`, `--leading-*` |
| Space | `--space-1…12` (4px grid) |
| Shape | `--radius-sm/md/lg/full`, `--shadow-sm/md/lg`, `--ring-focus` |
| Motion | `--duration-fast/base/slow`, `--ease-standard` (zeroed under reduced motion) |

## 5. Components (`web/src/ui`)

| Component | Use for |
|---|---|
| `Button`, `ButtonLink` | Actions. One `primary` per view (sky cyan, ink text); `secondary` for others; `ghost` for low-emphasis/toolbar; `danger` for destructive. |
| `StatusBadge`, `Badge` | Compact status with icon + word; neutral/accent/mock labels. |
| `Callout` | A verdict or explanation that needs attention, in plain language. |
| `Card`, `Stat` | Grouped content; key figures with a label and a hint. |
| `Meter`, `riskLevel` | 0–1 scores with a word (Very low … Very high). |
| `SegmentedControl` | Switching a view mode (2–4 options). |
| `Disclosure` | Details on demand. |
| `SearchInput`, `Select`, `Kbd` | Inputs; `/` shortcut built in. |
| `EmptyState`, `Skeleton` | Nothing to show (say why and what next); loading. |
| `Landscape`, `Logo` | Brand moments. |

## 6. Writing

- Lead with the decision: "Not eligible for rural credit", then why.
- Use the credit officer's terms (CAR, embargo, Pronaf) and explain the
  others.
- Sentence case everywhere; no jargon codes in the UI.
- Every finding names its source and snapshot date.

## 7. Checklist for a UI change

- [ ] Whose problem, which decision? Stated in the PR.
- [ ] Only tokens and `ui` components; new patterns added to `ui` and `/design`.
- [ ] Status shown with icon + word; numbers have a plain-language level.
- [ ] Keyboard: reachable, visible focus, sensible tab order.
- [ ] `npm run build` and `npm run check:contrast` pass.
- [ ] Screenshots attached; feedback logged in `design-feedback.md`.
