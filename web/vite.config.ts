import { defineConfig, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import sirv from "sirv";

// Serve ../data/tiles (built by the Python ingest, never committed) at /tiles
// in dev and preview, with the range requests PMTiles needs. In containers
// nginx serves the same folder; in the cloud it's object storage + CDN.
const tiles = (): Connect.NextHandleFunction => sirv("../data/tiles", { dev: true, etag: true });

export default defineConfig({
  plugins: [
    react(),
    {
      name: "tabush-tiles",
      configureServer: (server) => void server.middlewares.use("/tiles", tiles()),
      configurePreviewServer: (server) => void server.middlewares.use("/tiles", tiles()),
    },
  ],
  server: { host: true, port: 5173 },
});
