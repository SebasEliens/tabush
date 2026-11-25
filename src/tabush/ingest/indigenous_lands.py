"""Indigenous lands (Terras Indígenas): download, normalise, snapshot and tile.

FUNAI is the authority for indigenous land limits. Two published copies are supported:

- ``ibge`` (default): the limits IBGE used for the 2022 Census, served from IBGE's
  GeoServer. Each record carries FUNAI's own code (``cd_funai``). It only holds lands in
  the later phases (declared, homologated, regularised).
- ``funai``: FUNAI's own GeoServer layer ``tis_poligonais``, which also holds lands still
  under study. FUNAI's server refuses many connections from outside Brazil, so this is
  for runs hosted in Brazil.

Run::

    uv run python -m tabush.ingest.indigenous_lands            # IBGE copy
    uv run python -m tabush.ingest.indigenous_lands --source funai

Outputs (all under ``data/``, which is gitignored):

- ``raw/indigenous_lands/<source>/<date>/<source>.geojson``: the download, untouched
- ``derived/indigenous_lands/<date>/indigenous_lands.parquet``: GeoParquet snapshot
- ``tiles/indigenous_lands.pmtiles`` and ``.json``: vector tiles for the web map, plus
  provenance shown in the map legend
"""

from __future__ import annotations

import argparse
import datetime as dt
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
import shapely

from tabush.geo import STORAGE_CRS, area_ha, assert_crs, assert_valid
from tabush.ingest import common

LAYER = "indigenous_lands"


@dataclass(frozen=True)
class SourceSpec:
    """Where a published copy lives and how its columns map onto ours."""

    key: str
    label: str  # shown to users next to the layer
    url: str
    columns: dict[str, str]  # source column -> our column


SOURCES: dict[str, SourceSpec] = {
    "ibge": SourceSpec(
        key="ibge",
        label="FUNAI limits via IBGE Census 2022",
        url=(
            "https://geoservicos.ibge.gov.br/geoserver/ows?service=WFS&version=2.0.0"
            "&request=GetFeature&typeNames=CGMAT:qg_2022_610_terraindigena__v02"
            f"&outputFormat=application/json&srsName=EPSG:{STORAGE_CRS}"
        ),
        columns={"cd_funai": "source_id", "nm_ti": "name", "fase": "phase"},
    ),
    "funai": SourceSpec(
        key="funai",
        label="FUNAI",
        url=(
            "https://geoserver.funai.gov.br/geoserver/Funai/ows?service=WFS&version=1.0.0"
            "&request=GetFeature&typeName=Funai:tis_poligonais"
            f"&outputFormat=application/json&srsName=EPSG:{STORAGE_CRS}"
        ),
        # Column names as published on FUNAI's GeoServer; not yet verified from a
        # Brazil-hosted run.
        columns={"terrai_cod": "source_id", "terrai_nom": "name", "fase_ti": "phase"},
    ),
}

OUTPUT_COLUMNS = ["source_id", "name", "phase", "area_ha", "source", "snapshot_date"]


def download(spec: SourceSpec, dest: Path, timeout: int = 600) -> Path:
    """Fetch the whole layer as GeoJSON and keep the raw bytes for reproducibility."""
    return common.download(spec.url, dest, timeout=timeout)


def normalise(raw: gpd.GeoDataFrame, spec: SourceSpec, snapshot_date: dt.date) -> gpd.GeoDataFrame:
    """Map source columns onto ours, fix geometry and add provenance."""
    missing = set(spec.columns) - set(raw.columns)
    if missing:
        raise ValueError(f"{spec.key}: expected columns {sorted(missing)} not in source")
    if raw.crs is None:
        raise ValueError(f"{spec.key}: source has no CRS")

    gdf = raw[[*spec.columns, "geometry"]].rename(columns=spec.columns).to_crs(STORAGE_CRS)
    gdf["source_id"] = gdf["source_id"].astype(str)
    gdf["geometry"] = shapely.make_valid(
        gdf.geometry.values, method="structure", keep_collapsed=False
    )
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()]
    gdf["area_ha"] = area_ha(gdf).round(1)
    gdf["source"] = spec.label
    gdf["snapshot_date"] = snapshot_date.isoformat()
    gdf = gdf[[*OUTPUT_COLUMNS, "geometry"]].reset_index(drop=True)

    assert_crs(gdf)
    assert_valid(gdf)
    assert {"source", "snapshot_date"} <= set(gdf.columns)
    return gdf


def build_tiles(gdf: gpd.GeoDataFrame, out: Path, max_zoom: int = 12) -> Path:
    """Write PMTiles for MapLibre, plus a small JSON with provenance for the legend."""
    return common.write_tiles(gdf, out, LAYER, max_zoom=max_zoom)


def run(source: str = "ibge", from_file: Path | None = None, snapshot: dt.date | None = None):
    spec = SOURCES[source]
    snapshot = snapshot or dt.date.today()
    root = common.data_dir()
    raw_path = from_file or download(
        spec, root / "raw" / LAYER / spec.key / snapshot.isoformat() / f"{spec.key}.geojson"
    )
    gdf = normalise(gpd.read_file(raw_path), spec, snapshot)

    parquet = common.snapshot_path(LAYER, snapshot.isoformat())
    parquet.parent.mkdir(parents=True, exist_ok=True)
    gdf.to_parquet(parquet)
    tiles = build_tiles(gdf, root / "tiles" / f"{LAYER}.pmtiles")
    print(f"{len(gdf)} indigenous lands from {spec.label}, snapshot {snapshot}")
    print(f"  {parquet}\n  {tiles}")
    return gdf


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--source", choices=sorted(SOURCES), default="ibge")
    p.add_argument("--from-file", type=Path, help="use an already downloaded GeoJSON")
    p.add_argument("--snapshot-date", type=dt.date.fromisoformat, help="default: today")
    a = p.parse_args()
    run(a.source, a.from_file, a.snapshot_date)


if __name__ == "__main__":
    main()
