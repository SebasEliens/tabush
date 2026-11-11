// Default runtime config for local dev. In containers this file is generated
// from environment variables by docker-entrypoint.d/40-tabush-config.sh.
window.__TABUSH_CONFIG__ = {
  apiUrl: "",          // empty = use the in-browser mock API
  mapStyleUrl: "",     // empty = built-in OpenStreetMap raster style
  tilesUrl: "/tiles",  // public data layers (PMTiles); see data/tiles
};
