import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

// End-to-end tests are written as Gherkin scenarios in ../features (the spec) and run by
// playwright-bdd against a production build. By default they use the synthetic fixture
// (npm run e2e:data) and a stubbed assistant; `npm run e2e:llm` runs the @llm golden
// questions against the real model and needs ANTHROPIC_API_KEY.
const llm = process.env.E2E_LLM === "1";
const port = 4173;

const testDir = defineBddConfig({
  featuresRoot: "..",
  features: "../features/*.feature",
  steps: "e2e/steps/*.ts",
  // @docs scenarios run against the docs site (docs-site/scripts/screenshots.mjs), not the app.
  tags: llm ? "@llm" : "not @llm and not @docs",
});

export default defineConfig({
  testDir,
  outputDir: "e2e/results",
  timeout: llm ? 180_000 : 60_000,
  workers: llm ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // screenshots are attached to PRs as visual proof
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      TABUSH_OPEN_DIR: process.env.TABUSH_OPEN_DIR ?? "../data/e2e/open",
      ANTHROPIC_API_KEY: llm ? (process.env.ANTHROPIC_API_KEY ?? "") : "",
    },
  },
});
