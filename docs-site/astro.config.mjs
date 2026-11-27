// Tabush living docs: Astro + Starlight, deployed to GitHub Pages.
// Pages in src/content/docs are authored here; research and design notes are
// synced from ../docs at build time (scripts/sync-docs.mjs), so docs/ stays the
// single source of truth and still reads well on github.com.
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";

const REPO = "https://github.com/SebasEliens/tabush";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://sebaseliens.github.io",
  base: process.env.SITE_BASE ?? "/tabush",
  integrations: [
    starlight({
      title: "Tabush",
      description: "Living docs: research, mocks, decisions and verification evidence.",
      social: [{ icon: "github", label: "GitHub", href: REPO }],
      editLink: { baseUrl: `${REPO}/edit/main/docs-site/` },
      lastUpdated: true,
      customCss: ["./src/styles/tabush.css"],
      sidebar: [
        { label: "Start here", items: ["index", "how-we-work"] },
        { label: "Mocks", items: ["mocks"] },
        { label: "Decisions", items: [{ autogenerate: { directory: "decisions" } }] },
        { label: "Specs and evidence", items: ["verification"] },
        { label: "Design", items: [{ autogenerate: { directory: "design" } }] },
        { label: "Research", items: [{ autogenerate: { directory: "research" } }] },
      ],
    }),
    react(),
  ],
  vite: { server: { fs: { allow: [".."] } } },
});
