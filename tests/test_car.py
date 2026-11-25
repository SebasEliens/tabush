import datetime as dt
import json

import geopandas as gpd
import pandas as pd
import pytest
from shapely.geometry import Polygon, box, mapping

from tabush.geo import assert_crs, assert_valid
from tabush.ingest.car import (
    OUTPUT_COLUMNS,
    SOURCE_LABEL,
    normalise,
    read_pages,
    size_class,
    uf_of,
    wfs_params,
)

SNAPSHOT = dt.date(2026, 11, 25)
BOWTIE = Polygon([(-52.0, -31.0), (-51.9, -30.9), (-51.9, -31.0), (-52.0, -30.9)])  # invalid


def feature(code, geom, **props):
    base = {
        "cod_imovel": code,
        "status_imovel": "AT",
        "dat_criacao": "2018-05-30T01:31:16Z",
        "area": 10.5,
        "condicao": "Aguardando análise",
        "uf": "RS",
        "municipio": "Canguçu",
        "cod_municipio_ibge": 4304507,
        "m_fiscal": 0.6,
        "tipo_imovel": "IRU",
    }
    return {"type": "Feature", "geometry": mapping(geom), "properties": base | props}


@pytest.fixture
def pages(tmp_path):
    a = feature("RS-4304507-A", box(-52.5, -31.3, -52.49, -31.29))
    b = feature("RS-4304507-B", BOWTIE, dat_criacao="2026-11-13T20:03:31.280Z", m_fiscal=20)
    paths = []
    for i, feats in enumerate([[a, b], [b]]):  # B repeated across pages
        p = tmp_path / f"page-{i:04d}.geojson"
        p.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
        paths.append(p)
    return paths


def test_read_pages_drops_records_repeated_across_pages(pages):
    raw = read_pages(pages)
    assert raw["cod_imovel"].tolist() == ["RS-4304507-A", "RS-4304507-B"]
    assert raw.crs.to_epsg() == 4674


def test_normalise_maps_columns_and_adds_provenance(pages):
    gdf = normalise(read_pages(pages), SNAPSHOT)
    assert list(gdf.columns) == [*OUTPUT_COLUMNS, "geometry"]
    assert gdf["registered_on"].tolist() == ["2018-05-30", "2026-11-13"]
    assert gdf["municipality_code"].iloc[0] == "4304507"
    assert (gdf["source"] == SOURCE_LABEL).all()
    assert (gdf["snapshot_date"] == "2026-11-25").all()
    assert gdf["area_ha"].iloc[0] == pytest.approx(105, rel=0.05)  # 0.01° box at 31°S
    assert_crs(gdf)
    assert_valid(gdf)  # the bow-tie was repaired


def test_normalise_keeps_no_personal_data(pages):
    raw = read_pages(pages).assign(cpf="123.456.789-00", nome="Fulano")
    gdf = normalise(raw, SNAPSHOT)
    assert not {"cpf", "nome"} & set(gdf.columns)


def test_size_class_uses_fiscal_modules_for_private_properties_only():
    types = pd.Series(["IRU", "IRU", "IRU", "IRU", "AST"])
    modules = pd.Series([0.5, 4.0, 4.1, 15.5, 2.0])
    assert size_class(types, modules).tolist() == ["small", "small", "medium", "large", pd.NA]


def test_wfs_query_pages_in_a_stable_order_with_lat_lon_bbox():
    params = wfs_params("rs", (-53.0, -31.7, -52.2, -30.9), start=20_000)
    assert params["typeNames"] == "sicar:sicar_imoveis_rs"
    assert params["startIndex"] == 20_000
    assert params["sortBy"] == "cod_imovel"
    assert params["BBOX"].startswith("-31.7,-53.0,-30.9,-52.2,")


def test_uf_comes_from_the_ibge_code():
    assert uf_of("4304507") == "rs"
    assert uf_of("1507300") == "pa"


def test_normalise_rejects_unexpected_schema(pages):
    raw = read_pages(pages).drop(columns="m_fiscal")
    with pytest.raises(ValueError, match="m_fiscal"):
        normalise(raw, SNAPSHOT)


def test_normalise_output_is_a_geodataframe(pages):
    assert isinstance(normalise(read_pages(pages), SNAPSHOT), gpd.GeoDataFrame)
