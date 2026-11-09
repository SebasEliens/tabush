"""CRS conventions, validity checks and H3 indexing used across the pipeline."""

import geopandas as gpd
import h3
import pandas as pd
from shapely.geometry import MultiPolygon, Polygon, mapping

STORAGE_CRS = 4674  # SIRGAS 2000, Brazil's official geodetic datum
AREA_CRS = 5880  # SIRGAS 2000 / Brazil Polyconic, for areas and distances
H3_RESOLUTION = 9


def assert_crs(gdf: gpd.GeoDataFrame, epsg: int = STORAGE_CRS) -> None:
    """Fail loudly if a GeoDataFrame is not in the expected CRS."""
    assert gdf.crs is not None and gdf.crs.to_epsg() == epsg, f"Expected EPSG:{epsg}, got {gdf.crs}"


def assert_valid(gdf: gpd.GeoDataFrame) -> None:
    """Fail if any geometry is invalid; fix upstream with `shapely.make_valid`."""
    invalid = (~gdf.geometry.is_valid).sum()
    assert invalid == 0, f"{invalid} invalid geometries; run shapely.make_valid first"


def area_ha(gdf: gpd.GeoDataFrame) -> pd.Series:
    """Polygon areas in hectares, computed in an equal-area-suitable projection."""
    return gdf.geometry.to_crs(AREA_CRS).area / 10_000


def to_h3_cells(geom: Polygon | MultiPolygon, resolution: int = H3_RESOLUTION) -> set[str]:
    """H3 cells whose centres fall inside a lon/lat polygon."""
    return set(h3.geo_to_cells(mapping(geom), resolution))
