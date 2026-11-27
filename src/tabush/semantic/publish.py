"""Publish the open data and its semantic layer as plain files the browser can query.

Everything lands in ``data/open/`` (gitignored), ready for a static host or object storage:

- one GeoParquet 2.0 file per layer (``rural_properties``, ``indigenous_lands``,
  ``protected_areas``, ``municipalities``), with geometry in Parquet's native GEOMETRY type
  in SIRGAS 2000 (EPSG:4674), written by DuckDB
- ``nodes.parquet`` and ``edges.parquet``: the knowledge graph as plain tables. Every
  entity is a node; every relation from the ontology is an edge with ``source``,
  ``snapshot_date`` and ``confidence``. No graph database server is needed: recursive SQL
  walks multi-hop paths.
- ``concepts.parquet``: the taxonomy, one row per concept
- ``semantic_model.json``: the compiled ontology and taxonomy with table bindings, read by
  the talk-to-the-data assistant
- ``examples.json``: golden questions with reference SQL (copied from ``semantic/``)
- ``manifest.json``: files, row counts, sources and snapshot dates

Public territories are clipped to the ones that touch the pilot municipalities, so the
browser downloads megabytes, not the whole country.

Run after the ingests::

    uv run python -m tabush.semantic.publish
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

import duckdb
import geopandas as gpd
import pandas as pd

from tabush.geo import AREA_CRS, assert_crs, assert_valid
from tabush.ingest import common
from tabush.semantic import model as sm

LAYERS = ["rural_properties", "indigenous_lands", "protected_areas", "municipalities"]
TERRITORIES = ["indigenous_lands", "protected_areas"]
CLASS_OF = {
    "rural_properties": "tabush:RuralProperty",
    "indigenous_lands": "tabush:IndigenousLand",
    "protected_areas": "tabush:ProtectedArea",
    "municipalities": "tabush:Municipality",
}
LABEL_COLUMN = {
    "rural_properties": "source_id",
    "indigenous_lands": "name",
    "protected_areas": "name",
    "municipalities": "name",
}

# Tables that are not classes: the graph and the taxonomy.
GRAPH_TABLES = {
    "nodes": {
        "description": (
            "Every entity in the open data, one row each. node_id is '<table>:<source_id>'."
        ),
        "columns": {
            "node_id": "Graph id, '<table>:<source_id>'",
            "node_type": "Ontology class, e.g. tabush:RuralProperty",
            "label": "Human-readable name (CAR code for properties)",
            "table": "Table holding the entity's attributes and geometry",
            "source_id": "The source's own id; joins to <table>.source_id",
            "source": "Data source",
            "snapshot_date": "Snapshot date of the source",
        },
    },
    "edges": {
        "description": (
            "Every relation instance: subject --predicate--> object, with provenance. "
            "Predicates: overlaps (property to property, indigenous land or public protected "
            "area), located_in (property to municipality), intersects (territory to "
            "municipality)."
        ),
        "columns": {
            "subject": "node_id of the subject",
            "predicate": "Relation name, see relations",
            "object": "node_id of the object",
            "overlap_ha": "Shared area in hectares (overlaps, intersects)",
            "overlap_pct": "Shared area as % of the subject (overlaps, intersects)",
            "confidence": "low / medium / high, see scheme tx:confidence",
            "source": "Data source of the subject",
            "snapshot_date": "Snapshot date of the subject",
            "object_source": "Data source of the object",
            "object_snapshot_date": "Snapshot date of the object",
        },
    },
    "concepts": {
        "description": (
            "The taxonomy: one row per concept. notation is the value stored in the coded column."
        ),
        "columns": {
            "concept_id": "Concept id, e.g. tx:car-pending",
            "scheme": "Concept scheme id",
            "notation": "Value used in the data",
            "label_en": "English label",
            "label_pt": "Portuguese label",
            "alt_labels": "Synonyms (list)",
            "definition": "Definition",
            "broader": "Parent concept id",
            "matches": "Matching AGROVOC concepts (list)",
            "requires_public_land": "Protected area categories: land must be public",
        },
    },
}


def out_dir() -> Path:
    return common.data_dir() / "open"


def load_layers() -> dict[str, gpd.GeoDataFrame]:
    layers = {}
    for layer in LAYERS:
        path = common.latest_snapshot(layer)
        if path is None:
            raise FileNotFoundError(
                f"No {layer} snapshot: run `uv run python -m tabush.ingest.{layer}` first"
            )
        layers[layer] = gpd.read_parquet(path)
    return layers


def clip_territories(layers: dict[str, gpd.GeoDataFrame]) -> dict[str, gpd.GeoDataFrame]:
    """Keep only territories that touch a pilot municipality."""
    area = layers["municipalities"][["geometry"]]
    out = dict(layers)
    for layer in TERRITORIES:
        gdf = layers[layer]
        hit = gpd.sjoin(gdf, area, predicate="intersects", how="inner").index.unique()
        out[layer] = gdf.loc[hit].reset_index(drop=True)
    return out


def node_id(table: str, source_id: pd.Series) -> pd.Series:
    return table + ":" + source_id.astype(str)


def build_nodes(layers: dict[str, gpd.GeoDataFrame]) -> pd.DataFrame:
    frames = []
    for table, gdf in layers.items():
        frames.append(
            pd.DataFrame(
                {
                    "node_id": node_id(table, gdf["source_id"]),
                    "node_type": CLASS_OF[table],
                    "label": gdf[LABEL_COLUMN[table]].astype(str),
                    "table": table,
                    "source_id": gdf["source_id"].astype(str),
                    "source": gdf["source"],
                    "snapshot_date": gdf["snapshot_date"],
                }
            )
        )
    return pd.concat(frames, ignore_index=True)


def build_edges(
    layers: dict[str, gpd.GeoDataFrame], overlaps: pd.DataFrame, nodes: pd.DataFrame
) -> pd.DataFrame:
    """Edges from the overlap rows, the registration municipality and territory extents."""
    cols = [
        "subject", "predicate", "object", "overlap_ha", "overlap_pct", "confidence",
        "source", "snapshot_date", "object_source", "object_snapshot_date",
    ]  # fmt: skip
    table_of = {"car": "rural_properties", **{t: t for t in TERRITORIES}}
    ov = pd.DataFrame(
        {
            "subject": node_id("rural_properties", overlaps["subject_id"]),
            "predicate": "overlaps",
            "object": [
                f"{table_of[layer]}:{oid}"
                for layer, oid in zip(overlaps["object_layer"], overlaps["object_id"], strict=True)
            ],
            "overlap_ha": overlaps["overlap_ha"],
            "overlap_pct": overlaps["overlap_pct"],
            "confidence": overlaps["confidence"],
            "source": overlaps["source"],
            "snapshot_date": overlaps["snapshot_date"],
            "object_source": overlaps["object_source"],
            "object_snapshot_date": overlaps["object_snapshot_date"],
        }
    )

    car, mun = layers["rural_properties"], layers["municipalities"]
    mun_meta = mun.set_index("source_id")
    loc = pd.DataFrame(
        {
            "subject": node_id("rural_properties", car["source_id"]),
            "predicate": "located_in",
            "object": node_id("municipalities", car["municipality_code"]),
            "confidence": "high",  # declared by the registrant, checked by SICAR
            "source": car["source"],
            "snapshot_date": car["snapshot_date"],
            "object_source": car["municipality_code"].map(mun_meta["source"]),
            "object_snapshot_date": car["municipality_code"].map(mun_meta["snapshot_date"]),
        }
    )

    parts = [ov, loc]
    mun_eq = mun[["source_id", "source", "snapshot_date", "geometry"]].to_crs(AREA_CRS)
    for layer in TERRITORIES:
        terr = layers[layer][["source_id", "source", "snapshot_date", "geometry"]].to_crs(AREA_CRS)
        if terr.empty:
            continue
        pieces = gpd.overlay(terr, mun_eq, how="intersection", keep_geom_type=True)
        own = terr.set_index("source_id").area
        pieces["overlap_ha"] = (pieces.area / 10_000).round(2)
        pieces["overlap_pct"] = (100 * pieces.area / pieces["source_id_1"].map(own)).round(1)
        parts.append(
            pd.DataFrame(
                {
                    "subject": node_id(layer, pieces["source_id_1"]),
                    "predicate": "intersects",
                    "object": node_id("municipalities", pieces["source_id_2"]),
                    "overlap_ha": pieces["overlap_ha"],
                    "overlap_pct": pieces["overlap_pct"],
                    "confidence": "high",
                    "source": pieces["source_1"],
                    "snapshot_date": pieces["snapshot_date_1"],
                    "object_source": pieces["source_2"],
                    "object_snapshot_date": pieces["snapshot_date_2"],
                }
            )
        )
    edges = pd.concat(parts, ignore_index=True)[cols]
    # Overlaps with CAR records registered just outside the pilot municipalities point at
    # nodes that are not published; drop them so every edge resolves.
    known = set(nodes["node_id"])
    return edges[edges["subject"].isin(known) & edges["object"].isin(known)].reset_index(drop=True)


def write_geoparquet(con: duckdb.DuckDBPyConnection, gdf: gpd.GeoDataFrame, path: Path) -> None:
    """GeoParquet 2.0: Parquet's native GEOMETRY type with the CRS on the column."""
    assert_crs(gdf)
    assert_valid(gdf)
    assert {"source", "snapshot_date"} <= set(gdf.columns)
    df = pd.DataFrame(gdf.drop(columns="geometry")).assign(wkb=gdf.geometry.to_wkb())
    con.register("layer_df", df)
    con.execute(
        f"""
        COPY (
          SELECT * EXCLUDE (wkb), ST_SetCRS(ST_GeomFromWKB(wkb), 'EPSG:4674') AS geometry
          FROM layer_df
        ) TO '{path}' (FORMAT parquet, COMPRESSION zstd, GEOPARQUET_VERSION 'V2')
        """
    ).fetchall()
    con.unregister("layer_df")


def table_facts(con: duckdb.DuckDBPyConnection, path: Path) -> dict:
    cols = con.execute(f"DESCRIBE SELECT * FROM '{path}'").fetchall()
    rows = con.execute(f"SELECT count(*) FROM '{path}'").fetchall()[0][0]
    # DuckDB spells a GEOMETRY column's CRS out as PROJJSON; the short form is enough here.
    facts = {
        "columns": {
            name: "GEOMETRY(EPSG:4674)" if typ.startswith("GEOMETRY") else typ
            for name, typ, *_ in cols
        },
        "rows": rows,
    }
    if "source" in facts["columns"]:
        sql = f"SELECT any_value(source), max(snapshot_date) FROM '{path}'"
        src = con.execute(sql).fetchall()[0]
        facts |= {"source": src[0], "snapshot_date": src[1]}
    return facts


def run_examples(con: duckdb.DuckDBPyConnection, dest: Path) -> dict:
    """Run every golden question's reference SQL and store the expected answer with it.

    The browser shows these as worked examples, and the LLM eval compares the assistant's
    answer with them. A reference query that fails stops the publish.
    """
    spec = json.loads((sm.semantic_dir() / "examples.json").read_text())
    for name in [*LAYERS, *GRAPH_TABLES]:
        con.execute(f"CREATE OR REPLACE VIEW {name} AS SELECT * FROM '{dest / name}.parquet'")
        con.fetchall()
    for ex in spec["examples"]:
        rel = con.execute(ex["sql"])
        columns = [d[0] for d in rel.description]
        rows = [dict(zip(columns, r, strict=True)) for r in rel.fetchall()]
        ex["expected"] = {"columns": columns, "row_count": len(rows), "rows": rows[:10]}
    return json.loads(json.dumps(spec, default=str))  # dates and decimals as text


def run(dest: Path | None = None) -> Path:
    dest = dest or out_dir()
    dest.mkdir(parents=True, exist_ok=True)
    layers = clip_territories(load_layers())
    overlaps = pd.read_parquet(
        common.latest_snapshot("rural_properties").with_name("tenure_overlaps.parquet")
    )
    nodes = build_nodes(layers)
    edges = build_edges(layers, overlaps, nodes)
    graph = sm.load()
    concepts = sm.concepts(graph)

    con = duckdb.connect()
    con.execute("INSTALL spatial").fetchall()
    con.execute("LOAD spatial").fetchall()
    facts = {}
    for name, gdf in layers.items():
        path = dest / f"{name}.parquet"
        write_geoparquet(con, gdf, path)
        facts[name] = table_facts(con, path)
    for name, df in {"nodes": nodes, "edges": edges, "concepts": concepts}.items():
        path = dest / f"{name}.parquet"
        con.register("t", df)
        con.execute(f"COPY t TO '{path}' (FORMAT parquet, COMPRESSION zstd)").fetchall()
        con.unregister("t")
        facts[name] = table_facts(con, path)

    compiled = sm.model(graph, facts)
    for name, spec in GRAPH_TABLES.items():
        compiled["tables"][name] = {
            "class": None,
            "description": spec["description"],
            "rows": facts[name]["rows"],
            "source": facts[name].get("source"),
            "snapshot_date": facts[name].get("snapshot_date"),
            "columns": [
                {"name": c, "type": t, "description": spec["columns"].get(c)}
                for c, t in facts[name]["columns"].items()
            ],
        }
    compiled["generated_at"] = dt.datetime.now(dt.UTC).isoformat(timespec="seconds")
    compiled["crs"] = "EPSG:4674"
    text = json.dumps(compiled, indent=1, ensure_ascii=False, allow_nan=False)
    (dest / "semantic_model.json").write_text(text)
    examples = run_examples(con, dest)
    (dest / "examples.json").write_text(json.dumps(examples, indent=1, ensure_ascii=False))

    manifest = {
        "generated_at": compiled["generated_at"],
        "format": "GeoParquet 2.0 (Parquet GEOMETRY type), EPSG:4674",
        "files": {
            name: {
                "file": f"{name}.parquet",
                "bytes": (dest / f"{name}.parquet").stat().st_size,
                **{k: v for k, v in facts[name].items() if k != "columns"},
            }
            for name in facts
        },
    }
    (dest / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    for name, f in manifest["files"].items():
        print(f"  {name:18} {f['rows']:>7} rows  {f['bytes'] / 1e6:6.1f} MB")
    print(f"  {dest}")
    return dest


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--out", type=Path, help="default: data/open")
    run(p.parse_args().out)


if __name__ == "__main__":
    main()
