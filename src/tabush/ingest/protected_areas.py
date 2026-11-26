"""Protected areas (Unidades de Conservação): download, normalise, snapshot and tile.

The source is MMA's National Register of Conservation Units (CNUC), published on
dados.mma.gov.br as a zipped shapefile about twice a year. It holds federal, state and
municipal units.

For land tenure the important split is who may own the land inside a unit. Under the
SNUC law (Lei 9.985/2000, arts. 9-21) some categories must be in public ownership, so a
private rural property registered inside one is a red flag. Others (environmental
protection areas, private reserves and a few more) allow private land.

Run::

    uv run python -m tabush.ingest.protected_areas
    uv run python -m tabush.ingest.protected_areas --url <newer CNUC zip>

Outputs (all under ``data/``, which is gitignored):

- ``raw/protected_areas/<date>/cnuc.zip``: the download, untouched
- ``derived/protected_areas/<date>/protected_areas.parquet``: GeoParquet snapshot
- ``tiles/protected_areas.pmtiles`` and ``.json``: vector tiles and provenance for the map
"""

from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

import geopandas as gpd
import pyogrio
import shapely

from tabush.geo import STORAGE_CRS, area_ha, assert_crs, assert_valid
from tabush.ingest import common

LAYER = "protected_areas"
SOURCE_LABEL = "MMA CNUC"
# The August 2025 release; newer ones are listed at
# https://dados.mma.gov.br/dataset/unidadesdeconservacao
DEFAULT_URL = (
    "https://dados.mma.gov.br/dataset/44b6dc8a-dc82-4a84-8d95-1b0da7c85dac/resource/"
    "6ba9a557-87e8-4882-acb7-b3e0f0ea192d/download/shp_cnuc_2025_08.zip"
)

# Source column -> our column. Only these are read: some free-text columns in the
# shapefile hold UTF-8 cut mid-character at the 254-byte DBF limit and fail to decode.
COLUMNS = {
    "cd_cnuc": "source_id",
    "nome_uc": "name",
    "categoria": "category",
    "grupo": "group",
    "esfera": "sphere",
}

# Categories whose land must be in public ownership (SNUC, Lei 9.985/2000).
PUBLIC_DOMAIN_CATEGORIES = {
    "Estação Ecológica",  # art. 9
    "Reserva Biológica",  # art. 10
    "Parque",  # art. 11
    "Floresta",  # art. 17
    "Reserva Extrativista",  # art. 18
    "Reserva de Fauna",  # art. 19
    "Reserva de Desenvolvimento Sustentável",  # art. 20
}

OUTPUT_COLUMNS = [
    "source_id",
    "name",
    "category",
    "group",
    "sphere",
    "public_domain",
    "area_ha",
    "source",
    "snapshot_date",
]


def polygon_layer(path: Path) -> str:
    """Name of the polygon layer in a CNUC zip (it also holds a points layer)."""
    layers = [name for name, geom in pyogrio.list_layers(path) if "Polygon" in (geom or "")]
    if len(layers) != 1:
        raise ValueError(f"expected one polygon layer in {path}, found {layers}")
    return layers[0]


def read_cnuc(path: Path) -> gpd.GeoDataFrame:
    return gpd.read_file(path, layer=polygon_layer(path), columns=list(COLUMNS))


def normalise(raw: gpd.GeoDataFrame, snapshot_date: dt.date) -> gpd.GeoDataFrame:
    """Map source columns onto ours, fix geometry, classify ownership and add provenance."""
    missing = set(COLUMNS) - set(raw.columns)
    if missing:
        raise ValueError(f"CNUC: expected columns {sorted(missing)} not in source")
    if raw.crs is None:
        raise ValueError("CNUC: source has no CRS")

    gdf = raw[[*COLUMNS, "geometry"]].rename(columns=COLUMNS).to_crs(STORAGE_CRS)
    gdf = gdf[gdf.geometry.notna()]
    gdf["geometry"] = shapely.make_valid(
        gdf.geometry.values, method="structure", keep_collapsed=False
    )
    gdf = gdf[~gdf.geometry.is_empty]
    gdf["public_domain"] = gdf["category"].isin(PUBLIC_DOMAIN_CATEGORIES)
    gdf["area_ha"] = area_ha(gdf).round(1)
    gdf["source"] = SOURCE_LABEL
    gdf["snapshot_date"] = snapshot_date.isoformat()
    gdf = gdf[[*OUTPUT_COLUMNS, "geometry"]].reset_index(drop=True)

    assert_crs(gdf)
    assert_valid(gdf)
    assert {"source", "snapshot_date"} <= set(gdf.columns)
    return gdf


def run(url: str = DEFAULT_URL, from_file: Path | None = None, snapshot: dt.date | None = None):
    snapshot = snapshot or dt.date.today()
    root = common.data_dir()
    raw_path = from_file or common.download(
        url, root / "raw" / LAYER / snapshot.isoformat() / "cnuc.zip"
    )
    gdf = normalise(read_cnuc(raw_path), snapshot)

    parquet = common.snapshot_path(LAYER, snapshot.isoformat())
    parquet.parent.mkdir(parents=True, exist_ok=True)
    gdf.to_parquet(parquet)
    tiles = common.write_tiles(gdf, root / "tiles" / f"{LAYER}.pmtiles", LAYER, max_zoom=12)
    print(f"{len(gdf)} protected areas from {SOURCE_LABEL}, snapshot {snapshot}")
    print(f"  {parquet}\n  {tiles}")
    return gdf


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--url", default=DEFAULT_URL, help="CNUC shapefile zip")
    p.add_argument("--from-file", type=Path, help="use an already downloaded zip")
    p.add_argument("--snapshot-date", type=dt.date.fromisoformat, help="default: today")
    a = p.parse_args()
    run(a.url, a.from_file, a.snapshot_date)


if __name__ == "__main__":
    main()
