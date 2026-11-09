#!/bin/sh
# Writes runtime config from env vars so the same image runs in every
# environment and on any cloud (12-factor). Empty TABUSH_API_URL = mock API.
set -eu
cat > /usr/share/nginx/html/config.js <<JS
window.__TABUSH_CONFIG__ = {
  apiUrl: "${TABUSH_API_URL:-}",
  mapStyleUrl: "${TABUSH_MAP_STYLE_URL:-}",
};
JS
