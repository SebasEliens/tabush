import datetime as dt

import geopandas as gpd
import pytest
from shapely.geometry import Polygon, box

from tabush.geo import assert_crs, assert_valid
from tabush.ingest.protected_areas import OUTPUT_COLUMNS, SOURCE_LABEL, normalise

SNAPSHOT = dt.date(2026, 11, 25)
BOWTIE = Polygon([(-52.0, -31.0), (-51.9, -30.9), (-51.9, -31.0), (-52.0, -30.9)])  # invalid


@pytest.fixture
def raw_cnuc():
    return gpd.GeoDataFrame(
        {
            "cd_cnuc": ["0000.00.0275", "0000.00.0004", "0000.00.9999"],
            "nome_uc": ["RESERVA BIOLÓGICA DAS PEROBAS", "APA DO RIO SÃO BARTOLOMEU", "SEM GEO"],
            "categoria": ["Reserva Biológica", "Área de Proteção Ambiental", "Parque"],
            "grupo": ["Proteção Integral", "Uso Sustentável", "Proteção Integral"],
            "esfera": ["Federal", "Federal", "Estadual"],
        },
        geometry=[box(-52.3, -31.2, -52.2, -31.1), BOWTIE, None],
        crs=4674,
    )


def test_normalise_maps_columns_and_adds_provenance(raw_cnuc):
    gdf = normalise(raw_cnuc, SNAPSHOT)
    assert list(gdf.columns) == [*OUTPUT_COLUMNS, "geometry"]
    assert gdf["source_id"].tolist() == ["0000.00.0275", "0000.00.0004"]  # no-geometry row dropped
    assert (gdf["source"] == SOURCE_LABEL).all()
    assert (gdf["snapshot_date"] == "2026-11-25").all()
    assert_crs(gdf)
    assert_valid(gdf)


def test_public_domain_follows_snuc_category(raw_cnuc):
    gdf = normalise(raw_cnuc, SNAPSHOT)
    # A biological reserve must be public land; an environmental protection area need not.
    assert gdf["public_domain"].tolist() == [True, False]


def test_normalise_rejects_unexpected_schema(raw_cnuc):
    with pytest.raises(ValueError, match="categoria"):
        normalise(raw_cnuc.drop(columns="categoria"), SNAPSHOT)
