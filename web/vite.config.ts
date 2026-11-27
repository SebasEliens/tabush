import { defineConfig, loadEnv, type Connect, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import sirv from "sirv";

// Serve ../data/tiles and ../data/open (built by the Python pipeline, never committed; the
// e2e tests point TABUSH_OPEN_DIR at a synthetic fixture instead) at
// /tiles and /open in dev and preview, with the range requests PMTiles and DuckDB need.
// In containers nginx serves the same folders; in the cloud it's object storage + CDN.
const serve = (dir: string): Connect.NextHandleFunction => sirv(dir, { dev: true, etag: true });

export default defineConfig(({ mode }) => {
  // ANTHROPIC_API_KEY from the repo's .env (or the shell). It is added by this server's
  // /llm proxy and never sent to the browser.
  const env = { ...loadEnv(mode, "..", ""), ...process.env };
  const llm: Record<string, ProxyOptions> = env.ANTHROPIC_API_KEY
    ? {
        "/llm": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/llm/, ""),
          headers: { "x-api-key": env.ANTHROPIC_API_KEY },
        },
      }
    : {};
  const mounts = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use("/tiles", serve("../data/tiles"));
    server.middlewares.use("/open", serve(env.TABUSH_OPEN_DIR || "../data/open"));
    if (!env.ANTHROPIC_API_KEY) {
      // Tell the app the assistant is off instead of failing on every question.
      server.middlewares.use("/llm", (_req, res) => {
        res.statusCode = 503;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ type: "error", error: { type: "not_configured", message: "ANTHROPIC_API_KEY is not set" } }));
      });
    }
  };
  return {
    plugins: [
      react(),
      {
        name: "tabush-data",
        configureServer: (server) => mounts(server),
        configurePreviewServer: (server) => mounts(server),
      },
    ],
    optimizeDeps: { exclude: ["@duckdb/duckdb-wasm"] },
    server: { host: true, port: 5173, proxy: llm },
    preview: { proxy: llm },
  };
});
