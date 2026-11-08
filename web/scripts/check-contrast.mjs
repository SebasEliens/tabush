// Checks WCAG 2.2 contrast for the semantic colour pairs the UI relies on.
// Usage: npm run check:contrast   (exits 1 on any failure)
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/design/tokens.css", import.meta.url), "utf8");
const vars = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const resolve = (name) => {
  let v = vars[name];
  for (let i = 0; v && v.startsWith("var(") && i < 10; i++) v = vars[v.slice(6, -1)];
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`cannot resolve --${name} (${v})`);
  return v;
};
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum] — 4.5 for text, 3 for large text / UI parts
const pairs = [
  ["color-text", "color-bg", 4.5], ["color-text", "color-surface", 4.5],
  ["color-text-secondary", "color-surface", 4.5], ["color-text-secondary", "color-bg", 4.5],
  ["color-text-muted", "color-surface", 4.5], ["color-text-muted", "color-bg", 4.5],
  ["color-text-on-accent", "color-accent", 4.5], ["color-text-on-accent", "color-accent-hover", 4.5],
  ["color-accent-text", "color-surface", 4.5], ["color-accent-text", "color-accent-subtle", 4.5],
  ["color-text-inverse", "color-surface-inverse", 4.5], ["color-text-inverse-muted", "color-surface-inverse", 4.5],
  ["color-danger-text", "color-danger-bg", 4.5], ["color-warning-text", "color-warning-bg", 4.5],
  ["color-success-text", "color-success-bg", 4.5], ["color-info-text", "color-info-bg", 4.5],
  ["color-text-on-accent", "color-danger", 4.5],
  ["color-danger", "color-surface", 3], ["color-warning", "color-surface", 3], ["color-success", "color-surface", 3],
  ["color-focus", "color-surface", 3], ["color-highlight", "color-surface-inverse", 3],
  ["color-border-strong", "color-surface", 1.5],
];

let failed = 0;
for (const [fg, bg, min] of pairs) {
  const r = ratio(resolve(fg), resolve(bg));
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${r.toFixed(2).padStart(5)} ≥ ${min}  --${fg} on --${bg}`);
}
if (failed) { console.error(`\n${failed} pair(s) below WCAG minimum`); process.exit(1); }
console.log("\nAll colour pairs meet WCAG AA.");
