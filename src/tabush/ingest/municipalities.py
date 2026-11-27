"""Municipalities: IBGE boundaries with 2022 Census population, for the pilot municipalities.

Population links the land data to people: how many live in a municipality, how many are
indigenous and how many of those live inside indigenous lands. It comes from IBGE's
aggregates API (SIDRA table 9718, Census 2022 first results), and the boundaries from
IBGE's mesh API, the same one :mod:`tabush.ingest.car` uses for bounding boxes. Both are
public and aggregate, so no personal data is involved.

Run::

    uv run python -m tabush.ingest.municipalities                       # Canguçu (RS)
    uv run python -m tabush.ingest.municipalities --municipio 4304507 --municipio 1507300

Outputs (all under ``data/``, which is gitignored):

- ``raw/municipalities/<date>/<code>.geojson`` and ``population.json``: downloads, untouched
- ``derived/municipalities/<date>/municipalities.parquet``: GeoParquet snapshot
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests
import shapely

from tabush.geo import STORAGE_CRS, area_ha, assert_crs, assert_valid
from tabush.ingest import common
from tabush.ingest.car import DEFAULT_MUNICIPIOS, IBGE_MESH_URL, uf_of

LAYER = "municipalities"
SOURCE_LABEL = "IBGE municipal mesh and Census 2022"
NAMES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios/{code}"
# Table 9718: resident population, total and indigenous, by household location.
# Variable 93 = resident population, 350 = indigenous people. Classification 2661 is the
# household location: 32776 total, 12869 inside indigenous lands. Classification 1714
# 60024 = every way of declaring oneself indigenous.
POPULATION_URL = (
    "https://servicodados.ibge.gov.br/api/v3/agregados/9718/periodos/2022/variaveis/93|350"
    "?localidades=N6[{codes}]&classificacao=1714[60024]|2661[32776,12869]"
)

OUTPUT_COLUMNS = [
    "source_id",
    "name",
    "uf",
    "population",
    "indigenous_population",
    "indigenous_population_in_ti",
    "area_ha",
    "source",
    "snapshot_date",
]


def download(municipios: list[str], dest: Path, timeout: int = 120) -> list[Path]:
    """Boundary, name and population for each municipality, kept raw for reproducibility."""
    dest.mkdir(parents=True, exist_ok=True)
    files = []
    for code in municipios:
        r = requests.get(
            IBGE_MESH_URL.format(code=code),
            params={"formato": "application/vnd.geo+json", "qualidade": "maxima"},
            timeout=timeout,
        )
        r.raise_for_status()
        mesh = r.json()
        name = requests.get(NAMES_URL.format(code=code), timeout=timeout)
        name.raise_for_status()
        for f in mesh["features"]:
            f["properties"] = {"codarea": code, "nome": name.json()["nome"]}
        path = dest / f"{code}.geojson"
        path.write_text(json.dumps(mesh, ensure_ascii=False))
        files.append(path)
    r = requests.get(POPULATION_URL.format(codes=",".join(municipios)), timeout=timeout)
    r.raise_for_status()
    (dest / "population.json").write_bytes(r.content)
    return files


def parse_population(payload: list[dict]) -> pd.DataFrame:
    """One row per municipality: population, indigenous people, indigenous people in TIs."""
    rows: dict[str, dict] = {}
    for var in payload:
        for res in var["resultados"]:
            where = {c["id"]: next(iter(c["categoria"])) for c in res["classificacoes"]}
            if var["id"] == "93":
                if where.get("2661") != "32776":
                    continue
                col = "population"
            else:
                col = (
                    "indigenous_population_in_ti"
                    if where.get("2661") == "12869"
                    else "indigenous_population"
                )
            for s in res["series"]:
                code = s["localidade"]["id"]
                value = s["serie"]["2022"]
                # SIDRA writes "-" for zero and "..." / "X" for not available or withheld.
                number = 0 if value == "-" else pd.to_numeric(value, errors="coerce")
                rows.setdefault(code, {"source_id": code})[col] = number
    df = pd.DataFrame(list(rows.values()))
    for col in ("population", "indigenous_population", "indigenous_population_in_ti"):
        df[col] = pd.to_numeric(df.get(col), errors="coerce").astype("Int64")
    return df


def normalise(
    meshes: list[Path], population: pd.DataFrame, snapshot_date: dt.date
) -> gpd.GeoDataFrame:
    frames = [gpd.read_file(p) for p in meshes]
    gdf = pd.concat(frames, ignore_index=True)
    gdf = gdf.rename(columns={"codarea": "source_id", "nome": "name"})
    gdf = gpd.GeoDataFrame(gdf, geometry="geometry", crs=frames[0].crs).to_crs(STORAGE_CRS)
    gdf["source_id"] = gdf["source_id"].astype(str)
    gdf["geometry"] = shapely.make_valid(gdf.geometry.values)
    gdf = gdf.dissolve(by="source_id", as_index=False, aggfunc="first")
    gdf["uf"] = gdf["source_id"].map(uf_of).str.upper()
    gdf = gdf.merge(population, on="source_id", how="left")
    gdf["area_ha"] = area_ha(gdf).round(2)
    gdf["source"] = SOURCE_LABEL
    gdf["snapshot_date"] = snapshot_date.isoformat()
    gdf = gdf[[*OUTPUT_COLUMNS, "geometry"]].reset_index(drop=True)

    assert_crs(gdf)
    assert_valid(gdf)
    assert {"source", "snapshot_date"} <= set(gdf.columns)
    return gdf


def run(municipios: list[str] = DEFAULT_MUNICIPIOS, snapshot: dt.date | None = None):
    snapshot = snapshot or dt.date.today()
    raw = common.data_dir() / "raw" / LAYER / snapshot.isoformat()
    meshes = download(municipios, raw)
    population = parse_population(json.loads((raw / "population.json").read_bytes()))
    gdf = normalise(meshes, population, snapshot)
    out = common.snapshot_path(LAYER, snapshot.isoformat())
    out.parent.mkdir(parents=True, exist_ok=True)
    gdf.to_parquet(out)
    print(f"{len(gdf)} municipalities, snapshot {snapshot}\n  {out}")
    return gdf


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--municipio", action="append", help="IBGE code; repeat for several")
    p.add_argument("--snapshot-date", type=dt.date.fromisoformat, help="default: today")
    a = p.parse_args()
    run(a.municipio or DEFAULT_MUNICIPIOS, a.snapshot_date)


if __name__ == "__main__":
    main()
