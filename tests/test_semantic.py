"""The semantic layer: taxonomy and ontology integrity, published files, golden questions.

The published-file tests run the whole pipeline (fixture snapshots -> publish) on the
synthetic fixture in tabush.semantic.fixture, so they need no network or real data.
"""

import json

import duckdb
import pytest
from rdflib import RDF, SKOS

from tabush.semantic import fixture
from tabush.semantic import model as sm


@pytest.fixture(scope="module")
def graph():
    return sm.load()


@pytest.fixture(scope="module")
def published(tmp_path_factory):
    root = tmp_path_factory.mktemp("data")
    mp = pytest.MonkeyPatch()
    mp.setenv("TABUSH_DATA_DIR", str(root))
    try:
        yield fixture.write()
    finally:
        mp.undo()


@pytest.fixture(scope="module")
def con(published):
    c = duckdb.connect()
    for f in published.glob("*.parquet"):
        c.execute(f"CREATE VIEW {f.stem} AS SELECT * FROM '{f}'").fetchall()
    return c


def rows(con, sql):
    return con.execute(sql).fetchall()


# ------------------------------------------------------------------ taxonomy and ontology


def test_every_concept_has_a_scheme_and_english_and_portuguese_labels(graph):
    df = sm.concepts(graph)
    assert len(df) > 50
    assert df["scheme"].notna().all()
    assert df["label_en"].notna().all(), df[df["label_en"].isna()]["concept_id"].tolist()
    assert df["label_pt"].notna().all(), df[df["label_pt"].isna()]["concept_id"].tolist()


def test_notations_are_unique_within_a_scheme(graph):
    df = sm.concepts(graph).dropna(subset=["notation"])
    dupes = df[df.duplicated(["scheme", "notation"], keep=False)]
    assert dupes.empty, dupes[["scheme", "notation"]]


def test_broader_concepts_exist_in_the_same_scheme(graph):
    df = sm.concepts(graph)
    scheme_of = dict(zip(df["concept_id"], df["scheme"], strict=True))
    for c in df.dropna(subset=["broader"]).itertuples():
        assert scheme_of.get(c.broader) == c.scheme, c.concept_id


def test_concept_schemes_and_column_bindings_agree(graph):
    """A column coded by a scheme and the scheme's own tabush:codes must name each other."""
    columns = sm._columns(graph)
    for scheme in graph.subjects(RDF.type, SKOS.ConceptScheme):
        codes = graph.value(scheme, sm.TABUSH.codes)
        if codes is None or str(codes).startswith("edges."):
            continue
        table, column = str(codes).split(".")
        assert columns[table][column].coded_by == sm.curie(scheme), codes


def test_agrovoc_links_use_the_agrovoc_namespace(graph):
    df = sm.concepts(graph)
    links = [m for ms in df["matches"] for m in ms]
    assert links, "expected AGROVOC matches"
    assert all(m.startswith("agrovoc:c_") for m in links)


# ------------------------------------------------------------------ published files


def test_layers_are_geoparquet_2_with_native_geometry(published):
    import pyarrow.parquet as pq

    for layer in ("rural_properties", "indigenous_lands", "protected_areas", "municipalities"):
        f = pq.ParquetFile(published / f"{layer}.parquet")
        geo = json.loads(f.metadata.metadata[b"geo"])
        assert geo["version"].startswith("2."), layer
        logical = str(f.schema.column(f.schema.names.index("geometry")).logical_type)
        assert "Geometry" in logical and "4674" in logical, (layer, logical)


def test_layers_keep_provenance(con):
    for layer in ("rural_properties", "indigenous_lands", "protected_areas", "municipalities"):
        sql = f"SELECT count(*) FROM {layer} WHERE source IS NULL OR snapshot_date IS NULL"
        missing = rows(con, sql)
        assert missing == [(0,)], layer


def test_every_edge_resolves_to_nodes_and_carries_provenance(con):
    assert rows(con, "SELECT count(*) FROM edges") != [(0,)]
    dangling = """
        SELECT count(*) FROM edges e
        WHERE e.subject NOT IN (SELECT node_id FROM nodes)
           OR e.object NOT IN (SELECT node_id FROM nodes)"""
    assert rows(con, dangling) == [(0,)]
    no_prov = """SELECT count(*) FROM edges
        WHERE source IS NULL OR snapshot_date IS NULL OR confidence IS NULL"""
    assert rows(con, no_prov) == [(0,)]


def test_edge_predicates_are_ontology_relations(con, published):
    model = json.loads((published / "semantic_model.json").read_text())
    known = {r["predicate"] for r in model["relations"]}
    used = {p for (p,) in rows(con, "SELECT DISTINCT predicate FROM edges")}
    assert used <= known


def test_overlap_shares_are_percentages(con):
    bad = "SELECT count(*) FROM edges WHERE overlap_pct < 0 OR overlap_pct > 100.0001"
    assert rows(con, bad) == [(0,)]


def test_coded_columns_only_hold_taxonomy_notations(con, published):
    """Every value in a coded column is a concept notation, so the assistant can map it."""
    model = json.loads((published / "semantic_model.json").read_text())
    for table, spec in model["tables"].items():
        for col in spec["columns"]:
            if not col.get("coded_by"):
                continue
            unknown = rows(
                con,
                f"""SELECT DISTINCT {col["name"]} FROM {table}
                    WHERE {col["name"]} IS NOT NULL AND {col["name"]} NOT IN (
                      SELECT notation FROM concepts WHERE scheme = '{col["coded_by"]}')""",
            )
            assert unknown == [], (table, col["name"], unknown)


def test_semantic_model_describes_every_published_column(published):
    model = json.loads((published / "semantic_model.json").read_text())
    for name in ("rural_properties", "edges", "nodes", "concepts"):
        cols = model["tables"][name]["columns"]
        assert cols and all(c["type"] for c in cols), name
    car = {c["name"]: c for c in model["tables"]["rural_properties"]["columns"]}
    assert car["status"]["coded_by"] == "tx:car-status"
    assert car["geometry"]["type"] == "GEOMETRY(EPSG:4674)"


# ------------------------------------------------------------------ golden questions


def test_every_golden_question_runs_and_returns_its_columns(published):
    spec = json.loads((sm.semantic_dir() / "examples.json").read_text())
    out = json.loads((published / "examples.json").read_text())
    assert [e["id"] for e in out["examples"]] == [e["id"] for e in spec["examples"]]
    for ex in out["examples"]:
        got = ex["expected"]
        assert got["columns"] == ex["expect"]["columns"], ex["id"]
        assert got["row_count"] >= ex["expect"].get("min_rows", 0), ex["id"]


def test_golden_answers_on_the_fixture(published):
    """The fixture is laid out so each answer is known."""
    examples = json.loads((published / "examples.json").read_text())["examples"]
    out = {e["id"]: e["expected"] for e in examples}
    assert out["family-farms-double-claims"]["rows"] == [
        {"overlapping": 2, "family_farms": 4, "pct": 50.0}
    ]
    in_ti = out["properties-in-indigenous-lands"]["rows"]
    assert [r["car_code"] for r in in_ti] == ["PA-1507300-I"]
    park = out["public-protected-area-claims"]["rows"][0]
    assert park["protected_area"] == "PARQUE NACIONAL EXEMPLO"
    hops = {r["hops"]: r["properties"] for r in out["overlap-chains-to-indigenous-land"]["rows"]}
    assert hops[0] == 1 and hops[1] >= 1 and hops[2] >= 1
