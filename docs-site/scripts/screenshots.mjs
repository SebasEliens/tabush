// Playwright smoke test and screenshots of the built docs site.
// Checks the scenarios in features/living-docs.feature against the real
// build, then saves screenshots to screenshots/ for the PR and the gallery.
// Usage: npm run build:all && npm run screenshots
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const PORT = 4321;
const base = (process.env.SITE_BASE ?? "/tabush").replace(/\/$/, "");
const root = `http://localhost:${PORT}${base}`;
const out = "screenshots";
mkdirSync(out, { recursive: true });

const server = spawn("npx", ["astro", "preview", "--port", String(PORT)], { stdio: "ignore" });
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failures.push(what);
};

try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${root}/`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const shot = (name) => page.screenshot({ path: `${out}/${name}.jpg`, quality: 80 });

  await page.goto(`${root}/`);
  check((await page.title()).includes("Tabush"), "home page loads");
  await shot("home");

  // Scenario: Read a research note synced from the repo
  await page.goto(`${root}/research/technical-requirements/`);
  check(await page.getByText("Synced from the repo").isVisible(), "research note shows which repo file to edit");
  await shot("research-note");

  // Scenario: Test a decision against my own priorities
  await page.goto(`${root}/decisions/0001-docs-site-starlight/`);
  const matrix = page.getByTestId("decision-matrix");
  await matrix.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const before = await matrix.getByTestId("rank-2").innerText();
  await matrix.getByLabel("Reuse the app's React and tokens").fill("0");
  const after = await matrix.getByTestId("rank-2").innerText();
  check(before !== after, "decision matrix re-ranks when a weight changes");
  await shot("decision-matrix");

  // Scenario: See how H3 resolution fits a family farm
  await page.goto(`${root}/decisions/0002-h3-resolution/`);
  const h3 = page.getByTestId("h3-explorer");
  await h3.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const at9 = parseInt(await h3.getByTestId("h3-count").innerText(), 10);
  await h3.getByRole("slider").fill("10");
  const at10 = parseInt(await h3.getByTestId("h3-count").innerText(), 10);
  check(at10 > at9, `H3 explorer: more cells at res 10 (${at10}) than at res 9 (${at9})`);
  await shot("h3-explorer");

  // Scenario: Click through the frontend mock
  await page.goto(`${root}/mocks/`);
  const app = page.frameLocator('[data-testid="live-mock"]');
  await app.getByRole("link", { name: "Portfolio" }).waitFor({ timeout: 15000 });
  check(true, "live mock app loads inside the page");
  await page.waitForTimeout(2000); // basemap tiles
  await shot("mocks");

  await page.goto(`${root}/verification/`);
  check((await page.getByTestId("feature").count()) > 0, "feature files render as specs");
  await page.getByText("Test a decision against my own priorities").click();
  await shot("verification");

  await browser.close();
} finally {
  server.kill();
}

if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
