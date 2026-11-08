import geopandas as gpd
import pytest
from shapely.geometry import box

from tabush.geo import STORAGE_CRS, area_ha, assert_crs, assert_valid, to_h3_cells

# ~1 km x 1 km square near Petrolina, PE
SQUARE = box(-40.51, -9.39, -40.5009, -9.381)


@pytest.fixture
def gdf():
    return gpd.GeoDataFrame({"id": [1]}, geometry=[SQUARE], crs=STORAGE_CRS)


def test_assert_crs_accepts_storage_crs(gdf):
    assert_crs(gdf)


def test_assert_crs_rejects_other_crs(gdf):
    with pytest.raises(AssertionError):
        assert_crs(gdf.to_crs(4326))


def test_assert_valid(gdf):
    assert_valid(gdf)


def test_area_ha_is_about_100(gdf):
    assert area_ha(gdf).iloc[0] == pytest.approx(100, rel=0.05)


def test_to_h3_cells_covers_square():
    cells = to_h3_cells(SQUARE)
    # res-9 cells are ~0.1 km2, so a 1 km2 square holds roughly 10 of them
    assert 5 <= len(cells) <= 20
