"""Rural Environmental Registry (CAR) properties: download, normalise, flag and tile.

CAR is Brazil's self-declared register of rural properties (SICAR, run by the Serviço
Florestal Brasileiro). Its public GeoServer publishes one WFS layer per state with each
record's code, type, status, area and municipality. It publishes no owner names or CPF,
so nothing personal enters the pipeline (LGPD).

Boundaries are drawn by the declarant and not checked against title deeds, so records
overlap each other and public land. Those overlaps are a known signal of land grabbing
(*grilagem*); :mod:`tabush.risk.tenure_overlaps` measures them and this module stores the
result with each property.

A run takes one or more pilot municipalities (IBGE codes). It downloads every CAR record
in each municipality's bounding box, so properties just across the boundary still count
as neighbours, and keeps the records registered in the pilot municipalities.

Run::

    uv run python -m tabush.ingest.car                       # Canguçu (RS), the map's pilot
    uv run python -m tabush.ingest.car --municipio 1507300   # São Félix do Xingu (PA)

Run the indigenous lands and protected areas ingests first so overlaps with them are
included; without them only CAR-to-CAR overlaps are measured.

Outputs (all under ``data/``, which is gitignored):

- ``raw/car/<date>/<municipio>/page-NNNN.geojson``: WFS pages, untouched
- ``derived/rural_properties/<date>/rural_properties.parquet``: GeoParquet snapshot with flags
- ``derived/rural_properties/<date>/tenure_overlaps.parquet``: one row per overlap, for
  the graph and for tracing a flag back to the records behind it
- ``tiles/rural_properties.pmtiles`` and ``.json``: vector tiles and provenance for the map
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import ssl
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests
import shapely
from requests.adapters import HTTPAdapter

from tabush.geo import STORAGE_CRS, area_ha, assert_crs, assert_valid
from tabush.ingest import common

LAYER = "rural_properties"
SOURCE_LABEL = "SICAR (CAR)"
WFS_URL = "https://geoserver.car.gov.br/geoserver/sicar/wfs"
IBGE_MESH_URL = "https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{code}"
PAGE_SIZE = 10_000  # the server's maximum per request
DEFAULT_MUNICIPIOS = ["4304507"]  # Canguçu (RS), known as the capital of family farming

# First two digits of an IBGE municipality code -> state abbreviation.
UF_BY_CODE = {
    "11": "ro", "12": "ac", "13": "am", "14": "rr", "15": "pa", "16": "ap", "17": "to",
    "21": "ma", "22": "pi", "23": "ce", "24": "rn", "25": "pb", "26": "pe", "27": "al",
    "28": "se", "29": "ba", "31": "mg", "32": "es", "33": "rj", "35": "sp", "41": "pr",
    "42": "sc", "43": "rs", "50": "ms", "51": "mt", "52": "go", "53": "df",
}  # fmt: skip

# Source column -> our column. Only these are kept.
COLUMNS = {
    "cod_imovel": "source_id",
    "tipo_imovel": "property_type",  # IRU rural property, AST settlement, PCT traditional
    "status_imovel": "status",  # AT active, PE pending, SU suspended, CA cancelled
    "condicao": "condition",  # stage of the state's review
    "municipio": "municipality",
    "cod_municipio_ibge": "municipality_code",
    "area": "declared_area_ha",
    "m_fiscal": "fiscal_modules",
    "dat_criacao": "registered_on",
}

OUTPUT_COLUMNS = [
    "source_id",
    "property_type",
    "status",
    "condition",
    "municipality",
    "municipality_code",
    "area_ha",
    "declared_area_ha",
    "fiscal_modules",
    "size_class",
    "registered_on",
    "source",
    "snapshot_date",
]


def uf_of(municipio: str) -> str:
    return UF_BY_CODE[str(municipio)[:2]]


class _SicarAdapter(HTTPAdapter):
    """SICAR offers only AES256-GCM-SHA384 (no forward secrecy), which OpenSSL 3 drops."""

    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()  # still verifies the certificate
        ctx.set_ciphers("DEFAULT:AES256-GCM-SHA384")
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


SICAR = requests.Session()
SICAR.mount("https://geoserver.car.gov.br", _SicarAdapter())


def municipality_bbox(municipio: str, timeout: int = 60) -> tuple[float, float, float, float]:
    """(minx, miny, maxx, maxy) of a municipality in lon/lat, from IBGE's mesh API."""
    r = requests.get(
        IBGE_MESH_URL.format(code=municipio),
        params={"formato": "application/vnd.geo+json", "qualidade": "maxima"},
        timeout=timeout,
    )
    r.raise_for_status()
    gdf = gpd.GeoDataFrame.from_features(r.json()["features"], crs=4674)
    if gdf.empty:
        raise ValueError(f"IBGE has no boundary for municipality {municipio}")
    return tuple(gdf.total_bounds)  # type: ignore[return-value]


def wfs_params(uf: str, bbox: tuple[float, float, float, float], start: int) -> dict:
    minx, miny, maxx, maxy = bbox
    return {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": f"sicar:sicar_imoveis_{uf}",
        "outputFormat": "application/json",
        "count": PAGE_SIZE,
        "startIndex": start,
        "sortBy": "cod_imovel",  # stable order, so pages neither skip nor repeat records
        # WFS 2.0 with an EPSG URN takes lat/lon axis order.
        "BBOX": f"{miny},{minx},{maxy},{maxx},urn:ogc:def:crs:EPSG::4674",
    }


def download_bbox(
    uf: str, bbox: tuple[float, float, float, float], dest: Path, timeout: int = 600
) -> list[Path]:
    """Page through every CAR record in a bounding box, keeping each raw page."""
    dest.mkdir(parents=True, exist_ok=True)
    pages, start = [], 0
    while True:
        r = SICAR.get(WFS_URL, params=wfs_params(uf, bbox, start), timeout=timeout)
        r.raise_for_status()
        page = dest / f"page-{start // PAGE_SIZE:04d}.geojson"
        page.write_bytes(r.content)
        pages.append(page)
        returned = r.json()["numberReturned"]
        start += returned
        if returned < PAGE_SIZE:
            return pages


def read_pages(pages: list[Path]) -> gpd.GeoDataFrame:
    frames = []
    for p in pages:
        features = json.loads(p.read_bytes())["features"]
        if features:
            # The server answers in SIRGAS 2000 (EPSG:4674), lon/lat order.
            frames.append(gpd.GeoDataFrame.from_features(features, crs=4674))
    if not frames:
        return gpd.GeoDataFrame(columns=[*COLUMNS, "geometry"], geometry="geometry", crs=4674)
    gdf = pd.concat(frames, ignore_index=True)
    return gdf.drop_duplicates("cod_imovel").reset_index(drop=True)


def size_class(property_type: pd.Series, fiscal_modules: pd.Series) -> pd.Series:
    """Legal size class of private rural properties (Lei 8.629/1993, art. 4).

    Up to 4 fiscal modules is a small property, which is also the size limit for family
    farming (Lei 11.326/2006, art. 3). Settlements and traditional territories get none.
    """
    cls = pd.cut(
        fiscal_modules,
        bins=[-float("inf"), 4, 15, float("inf")],
        labels=["small", "medium", "large"],
    ).astype("string")
    return cls.where(property_type == "IRU")


def normalise(raw: gpd.GeoDataFrame, snapshot_date: dt.date) -> gpd.GeoDataFrame:
    """Map source columns onto ours, fix geometry, classify size and add provenance."""
    missing = set(COLUMNS) - set(raw.columns)
    if missing:
        raise ValueError(f"CAR: expected columns {sorted(missing)} not in source")
    if raw.crs is None:
        raise ValueError("CAR: source has no CRS")

    gdf = raw[[*COLUMNS, "geometry"]].rename(columns=COLUMNS).to_crs(STORAGE_CRS)
    gdf = gdf[gdf.geometry.notna()].copy()
    gdf["geometry"] = shapely.make_valid(
        gdf.geometry.values, method="structure", keep_collapsed=False
    )
    gdf = gdf[~gdf.geometry.is_empty].copy()
    gdf["municipality_code"] = gdf["municipality_code"].astype(str)
    gdf["declared_area_ha"] = pd.to_numeric(gdf["declared_area_ha"]).round(2)
    gdf["fiscal_modules"] = pd.to_numeric(gdf["fiscal_modules"]).round(2)
    gdf["registered_on"] = pd.to_datetime(
        gdf["registered_on"], utc=True, format="ISO8601"
    ).dt.strftime("%Y-%m-%d")
    gdf["area_ha"] = area_ha(gdf).round(2)
    gdf["size_class"] = size_class(gdf["property_type"], gdf["fiscal_modules"])
    gdf["source"] = SOURCE_LABEL
    gdf["snapshot_date"] = snapshot_date.isoformat()
    gdf = gdf[[*OUTPUT_COLUMNS, "geometry"]].reset_index(drop=True)

    assert_crs(gdf)
    assert_valid(gdf)
    assert {"source", "snapshot_date"} <= set(gdf.columns)
    return gdf


def load_territories() -> dict[str, gpd.GeoDataFrame]:
    """Latest snapshots of the public territory layers that have been ingested."""
    found = {}
    for layer in ("indigenous_lands", "protected_areas"):
        path = common.latest_snapshot(layer)
        if path:
            found[layer] = gpd.read_parquet(path)
    return found


def run(
    municipios: list[str] = DEFAULT_MUNICIPIOS,
    snapshot: dt.date | None = None,
    from_dir: Path | None = None,
):
    from tabush.risk.tenure_overlaps import flag_properties

    snapshot = snapshot or dt.date.today()
    root = common.data_dir()
    raw_root = from_dir or root / "raw" / "car" / snapshot.isoformat()
    pages = []
    for m in municipios:
        dest = raw_root / m
        if from_dir is None:
            download_bbox(uf_of(m), municipality_bbox(m), dest)
        pages += sorted(dest.glob("page-*.geojson"))

    everything = normalise(read_pages(pages), snapshot)
    territories = load_territories()
    flagged, overlaps = flag_properties(everything, territories)
    pilot = flagged[flagged["municipality_code"].isin(municipios)].reset_index(drop=True)
    overlaps = overlaps[overlaps["subject_id"].isin(pilot["source_id"])].reset_index(drop=True)

    parquet = common.snapshot_path(LAYER, snapshot.isoformat())
    parquet.parent.mkdir(parents=True, exist_ok=True)
    pilot.to_parquet(parquet)
    overlaps.to_parquet(parquet.with_name("tenure_overlaps.parquet"))
    counts = pilot["tenure_flag"].value_counts().to_dict()
    tiles = common.write_tiles(
        pilot,
        root / "tiles" / f"{LAYER}.pmtiles",
        LAYER,
        max_zoom=14,
        extra_meta={
            # Name and lon/lat bounds of each municipality, so the map can fly there.
            "municipalities": [
                {"name": name, "bbox": [round(v, 5) for v in grp.to_crs(4326).total_bounds]}
                for name, grp in pilot.groupby("municipality")
            ],
            "flags": counts,
            "compared_with": {k: v["source"].iloc[0] for k, v in territories.items()},
        },
    )
    print(f"{len(pilot)} CAR records in {len(municipios)} municipalities, snapshot {snapshot}")
    print(f"  flags: {counts}")
    print(f"  {parquet}\n  {tiles}")
    return pilot, overlaps


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument(
        "--municipio",
        action="append",
        help="IBGE municipality code; repeat for several (default: Canguçu, 4304507)",
    )
    p.add_argument("--snapshot-date", type=dt.date.fromisoformat, help="default: today")
    p.add_argument("--from-dir", type=Path, help="reuse raw pages from an earlier run")
    a = p.parse_args()
    run(a.municipio or DEFAULT_MUNICIPIOS, a.snapshot_date, a.from_dir)


if __name__ == "__main__":
    main()
