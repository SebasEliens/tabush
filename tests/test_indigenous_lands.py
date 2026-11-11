import datetime as dt
import json

import geopandas as gpd
import pytest
from shapely.geometry import Polygon, box

from tabush.geo import assert_crs, assert_valid
from tabush.ingest.indigenous_lands import OUTPUT_COLUMNS, SOURCES, build_tiles, normalise

SNAPSHOT = dt.date(2026, 11, 11)
BOWTIE = Polygon([(-52.0, -31.0), (-51.9, -30.9), (-51.9, -31.0), (-52.0, -30.9)])  # invalid


@pytest.fixture
def raw_ibge():
    return gpd.GeoDataFrame(
        {
            "cd_funai": [31701, 14301],
            "nm_ti": ["Pacheca", "Guarani de Águas Brancas"],
            "fase": ["Regularizada", "Declarada"],
            "quadro": [610, 610],
        },
        geometry=[box(-52.3, -31.2, -52.2, -31.1), BOWTIE],
        crs=4326,
    )


def test_normalise_maps_columns_and_adds_provenance(raw_ibge):
    gdf = normalise(raw_ibge, SOURCES["ibge"], SNAPSHOT)
    assert list(gdf.columns) == [*OUTPUT_COLUMNS, "geometry"]
    assert gdf["source_id"].tolist() == ["31701", "14301"]
    assert (gdf["snapshot_date"] == "2026-11-11").all()
    assert gdf["source"].iloc[0] == SOURCES["ibge"].label
    assert_crs(gdf)
    assert_valid(gdf)  # the bow-tie was repaired


def test_normalise_area_is_in_hectares(raw_ibge):
    gdf = normalise(raw_ibge, SOURCES["ibge"], SNAPSHOT)
    # 0.1° x 0.1° at 31°S is about 9.5 km x 11.1 km
    assert gdf["area_ha"].iloc[0] == pytest.approx(10_600, rel=0.05)


def test_normalise_rejects_unexpected_schema(raw_ibge):
    with pytest.raises(ValueError, match="terrai_cod"):
        normalise(raw_ibge, SOURCES["funai"], SNAPSHOT)


def test_build_tiles_writes_pmtiles_and_provenance(raw_ibge, tmp_path):
    gdf = normalise(raw_ibge, SOURCES["ibge"], SNAPSHOT)
    out = build_tiles(gdf, tmp_path / "indigenous_lands.pmtiles", max_zoom=6)
    assert out.read_bytes()[:7] == b"PMTiles"
    meta = json.loads(out.with_suffix(".json").read_text())
    assert meta == {
        "layer": "indigenous_lands",
        "source": SOURCES["ibge"].label,
        "snapshot_date": "2026-11-11",
        "features": 2,
    }
