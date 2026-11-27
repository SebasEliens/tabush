"""A tiny synthetic snapshot of every layer, for tests and CI without network or real data.

Two municipalities with the real names and codes of the pilots, a handful of CAR records,
one indigenous land and one public protected area, laid out so that every golden question
in ``semantic/examples.json`` has rows to return: family farms claiming the same land in
Canguçu, and in São Félix do Xingu a property inside an indigenous land, another one
inside a park, and a chain of overlapping claims leading to the indigenous land.

The records are made up. Only the geometry rules (CRS, validity, provenance) are real.

Run::

    TABUSH_DATA_DIR=/tmp/tabush-fixture uv run python -m tabush.semantic.fixture
"""

from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

import geopandas as gpd
from shapely.geometry import box

from tabush.geo import STORAGE_CRS, area_ha
from tabush.ingest import common
from tabush.ingest.car import OUTPUT_COLUMNS as CAR_COLUMNS
from tabush.risk.tenure_overlaps import flag_properties
from tabush.semantic import publish

SNAPSHOT = dt.date(2026, 1, 1)
D = 0.01  # about 1 km at these latitudes

CANGUCU = (-52.70, -31.40)
SAO_FELIX = (-52.00, -6.60)


def _at(origin: tuple[float, float], x: float, y: float, w: float = D, h: float = D):
    return box(origin[0] + x, origin[1] + y, origin[0] + x + w, origin[1] + y + h)


def _gdf(rows: list[dict], source: str) -> gpd.GeoDataFrame:
    gdf = gpd.GeoDataFrame(rows, geometry="geometry", crs=STORAGE_CRS)
    gdf["area_ha"] = area_ha(gdf).round(2)
    gdf["source"] = source
    gdf["snapshot_date"] = SNAPSHOT.isoformat()
    return gdf


def municipalities() -> gpd.GeoDataFrame:
    rows = [
        {"source_id": "4304507", "name": "Canguçu", "uf": "RS", "population": 49680,
         "indigenous_population": 33, "indigenous_population_in_ti": 0,
         "geometry": _at(CANGUCU, -0.1, -0.1, 0.3, 0.3)},
        {"source_id": "1507300", "name": "São Félix do Xingu", "uf": "PA", "population": 65418,
         "indigenous_population": 2451, "indigenous_population_in_ti": 2173,
         "geometry": _at(SAO_FELIX, -0.1, -0.1, 0.3, 0.3)},
    ]  # fmt: skip
    gdf = _gdf(rows, "IBGE municipal mesh and Census 2022 (fixture)")
    cols = [
        "source_id", "name", "uf", "population", "indigenous_population",
        "indigenous_population_in_ti", "area_ha", "source", "snapshot_date", "geometry",
    ]  # fmt: skip
    return gdf[cols]


def indigenous_lands() -> gpd.GeoDataFrame:
    rows = [{"source_id": "99001", "name": "Terra Indígena Exemplo", "phase": "Regularizada",
             "geometry": _at(SAO_FELIX, 0.05, 0.0, 0.1, 0.1)}]  # fmt: skip
    gdf = _gdf(rows, "FUNAI limits via IBGE Census 2022 (fixture)")
    return gdf[["source_id", "name", "phase", "area_ha", "source", "snapshot_date", "geometry"]]


def protected_areas() -> gpd.GeoDataFrame:
    rows = [
        {"source_id": "0000.00.0001", "name": "PARQUE NACIONAL EXEMPLO", "category": "Parque",
         "group": "Proteção Integral", "sphere": "Federal", "public_domain": True,
         "geometry": _at(SAO_FELIX, 0.0, 0.15, 0.05, 0.05)},
        {"source_id": "0000.00.0002", "name": "APA EXEMPLO",
         "category": "Área de Proteção Ambiental",
         "group": "Uso Sustentável", "sphere": "Estadual", "public_domain": False,
         "geometry": _at(CANGUCU, 0.0, 0.0, 0.1, 0.1)},
    ]  # fmt: skip
    gdf = _gdf(rows, "MMA CNUC (fixture)")
    cols = ["source_id", "name", "category", "group", "sphere", "public_domain", "area_ha",
            "source", "snapshot_date", "geometry"]  # fmt: skip
    return gdf[cols]


def rural_properties() -> gpd.GeoDataFrame:
    def prop(code, mun, origin, x, y, w=D, kind="IRU", status="AT", modules=0.5):
        return {
            "source_id": code, "property_type": kind, "status": status,
            "condition": "Aguardando análise", "municipality": mun[0],
            "municipality_code": mun[1], "declared_area_ha": None, "fiscal_modules": modules,
            "registered_on": "2018-05-30", "geometry": _at(origin, x, y, w, D),
        }  # fmt: skip

    can, sfx = ("Canguçu", "4304507"), ("São Félix do Xingu", "1507300")
    rows = [
        prop("RS-4304507-A", can, CANGUCU, 0.00, 0.00),
        prop("RS-4304507-B", can, CANGUCU, 0.005, 0.00),  # half of A: a double claim
        prop("RS-4304507-C", can, CANGUCU, 0.05, 0.05),
        prop("RS-4304507-D", can, CANGUCU, 0.08, 0.08, modules=20.0),
        prop("RS-4304507-E", can, CANGUCU, 0.10, 0.10, status="PE"),
        prop("RS-4304507-F", can, CANGUCU, 0.12, 0.12, status="CA"),
        prop("RS-4304507-S", can, CANGUCU, 0.15, 0.00, w=0.05, kind="AST", modules=30.0),
        prop("PA-1507300-I", sfx, SAO_FELIX, 0.045, 0.00, modules=8.0),  # 50% in the TI
        prop("PA-1507300-J", sfx, SAO_FELIX, 0.040, 0.00, modules=8.0),  # overlaps I
        prop("PA-1507300-K", sfx, SAO_FELIX, 0.035, 0.00, modules=8.0),  # overlaps J
        prop("PA-1507300-P", sfx, SAO_FELIX, 0.00, 0.145, modules=60.0),  # in the park
    ]
    gdf = _gdf(rows, "SICAR (CAR) (fixture)")
    gdf["declared_area_ha"] = gdf["area_ha"]
    from tabush.ingest.car import size_class

    gdf["size_class"] = size_class(gdf["property_type"], gdf["fiscal_modules"])
    return gdf[[*CAR_COLUMNS, "geometry"]]


def write(root: Path | None = None) -> Path:
    """Write fixture snapshots under the data dir, the way the ingests would."""
    snap = SNAPSHOT.isoformat()
    layers = {
        "municipalities": municipalities(),
        "indigenous_lands": indigenous_lands(),
        "protected_areas": protected_areas(),
    }
    flagged, overlaps = flag_properties(
        rural_properties(),
        {k: layers[k] for k in ("indigenous_lands", "protected_areas")},
    )
    layers["rural_properties"] = flagged
    for name, gdf in layers.items():
        path = common.snapshot_path(name, snap)
        path.parent.mkdir(parents=True, exist_ok=True)
        gdf.to_parquet(path)
    overlaps.to_parquet(common.snapshot_path("rural_properties", snap).with_name(
        "tenure_overlaps.parquet"
    ))  # fmt: skip
    return publish.run(root)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--out", type=Path, help="default: <data dir>/open")
    write(p.parse_args().out)


if __name__ == "__main__":
    main()
