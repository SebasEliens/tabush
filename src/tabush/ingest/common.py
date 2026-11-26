"""Helpers shared by the ingest modules: data folders, dated snapshots and web tiles."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import geopandas as gpd
import requests


def data_dir() -> Path:
    """Root of raw and derived data; gitignored, override with ``TABUSH_DATA_DIR``."""
    return Path(os.environ.get("TABUSH_DATA_DIR", "data"))


def snapshot_path(layer: str, snapshot: str) -> Path:
    """Where the dated GeoParquet snapshot of a layer lives."""
    return data_dir() / "derived" / layer / snapshot / f"{layer}.parquet"


def latest_snapshot(layer: str) -> Path | None:
    """The newest GeoParquet snapshot of a layer, or None if it was never ingested."""
    found = sorted((data_dir() / "derived" / layer).glob(f"*/{layer}.parquet"))
    return found[-1] if found else None


def download(url: str, dest: Path, timeout: int = 600, **kwargs: Any) -> Path:
    """Stream a URL to disk and keep the raw bytes for reproducibility."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=timeout, **kwargs) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)
    return dest


def write_tiles(
    gdf: gpd.GeoDataFrame,
    out: Path,
    layer: str,
    max_zoom: int = 12,
    extra_meta: dict[str, Any] | None = None,
) -> Path:
    """Write PMTiles for MapLibre, plus a small JSON with provenance for the legend."""
    import freestiler  # imported here so the rest of the package works without it

    out.parent.mkdir(parents=True, exist_ok=True)
    # Web tiles are in Web Mercator; freestiler expects lon/lat (EPSG:4326).
    freestiler.freestile(
        gdf.to_crs(4326), out, layer_name=layer, min_zoom=0, max_zoom=max_zoom, quiet=True
    )
    meta = {
        "layer": layer,
        "source": gdf["source"].iloc[0],
        "snapshot_date": gdf["snapshot_date"].iloc[0],
        "features": len(gdf),
        **(extra_meta or {}),
    }
    out.with_suffix(".json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    return out
