"""Compile the taxonomy and ontology (Turtle, in ``semantic/``) into tables and a JSON model.

The Turtle files are the source of truth and stay readable by any RDF tool. This module
flattens them into what a browser needs: one row per concept, and a compact model that
tells the talk-to-the-data assistant which table holds which class, what each column means,
which concept scheme codes it, and which relations exist as edges.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
from rdflib import OWL, RDF, RDFS, SKOS, Graph, Literal, Namespace, URIRef

TABUSH = Namespace("https://tabush.org/ontology#")
TX = Namespace("https://tabush.org/taxonomy/")
AGROVOC = "http://aims.fao.org/aos/agrovoc/"

PREFIXES = {
    str(TX): "tx:",
    str(TABUSH): "tabush:",
    AGROVOC: "agrovoc:",
    "http://www.opengis.net/ont/geosparql#": "geo:",
    "http://www.w3.org/ns/prov#": "prov:",
}


def semantic_dir() -> Path:
    """Folder with taxonomy.ttl and ontology.ttl; override with ``TABUSH_SEMANTIC_DIR``."""
    default = Path(__file__).resolve().parents[3] / "semantic"
    return Path(os.environ.get("TABUSH_SEMANTIC_DIR", default))


def curie(uri: URIRef | str) -> str:
    s = str(uri)
    for ns, prefix in PREFIXES.items():
        if s.startswith(ns):
            return prefix + s[len(ns) :]
    return s


def load(folder: Path | None = None) -> Graph:
    folder = folder or semantic_dir()
    g = Graph()
    for name in ("taxonomy.ttl", "ontology.ttl"):
        g.parse(folder / name, format="turtle")
    return g


def _label(g: Graph, node: URIRef, lang: str = "en", prop: URIRef = SKOS.prefLabel) -> str | None:
    for value in g.objects(node, prop):
        if isinstance(value, Literal) and value.language == lang:
            return str(value)
    return None


def _text(g: Graph, node: URIRef, prop: URIRef) -> str | None:
    value = g.value(node, prop)
    return None if value is None else str(value)


def concepts(g: Graph) -> pd.DataFrame:
    """One row per SKOS concept, with the notation used in the data and its labels."""
    rows = []
    for c in sorted(g.subjects(RDF.type, SKOS.Concept)):
        scheme = g.value(c, SKOS.inScheme)
        broader = g.value(c, SKOS.broader)
        matches = sorted(
            curie(m) for p in (SKOS.exactMatch, SKOS.closeMatch) for m in g.objects(c, p)
        )
        public = g.value(c, TABUSH.requiresPublicLand)
        rows.append(
            {
                "concept_id": curie(c),
                "scheme": curie(scheme) if scheme else None,
                "notation": _text(g, c, SKOS.notation),
                "label_en": _label(g, c, "en"),
                "label_pt": _label(g, c, "pt"),
                "alt_labels": sorted(str(a) for a in g.objects(c, SKOS.altLabel)),
                "definition": _label(g, c, "en", SKOS.definition),
                "broader": curie(broader) if broader else None,
                "matches": matches,
                "requires_public_land": None if public is None else bool(public.toPython()),
            }
        )
    return pd.DataFrame(rows)


@dataclass
class Column:
    name: str
    label: str | None = None
    description: str | None = None
    unit: str | None = None
    coded_by: str | None = None


def _columns(g: Graph) -> dict[str, dict[str, Column]]:
    """table -> column -> meaning, from the tabush:column bindings."""
    out: dict[str, dict[str, Column]] = {}
    for prop in g.subjects(TABUSH.column, None):
        table, column = str(g.value(prop, TABUSH.column)).split(".", 1)
        scheme = g.value(prop, TABUSH.codedBy)
        out.setdefault(table, {})[column] = Column(
            name=column,
            label=_label(g, prop, "en", RDFS.label),
            description=_label(g, prop, "en", RDFS.comment),
            unit=_text(g, prop, TABUSH.unit),
            coded_by=curie(scheme) if scheme else None,
        )
    return out


def _range(g: Graph, prop: URIRef) -> list[str]:
    r = g.value(prop, RDFS.range)
    if r is None:
        return []
    members = g.value(r, OWL.unionOf)
    if members is None:
        return [curie(r)]
    items = []
    while members and members != RDF.nil:
        items.append(curie(g.value(members, RDF.first)))
        members = g.value(members, RDF.rest)
    return items


def model(g: Graph, tables: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    """Compact semantic model for the assistant and the UI.

    ``tables`` maps a published table name to its facts: ``columns`` (name -> DuckDB type),
    ``rows``, ``source`` and ``snapshot_date``. Columns found in the files but not described
    in the ontology are still listed, so the model never hides data.
    """
    tables = tables or {}
    described = _columns(g)
    wildcard = described.pop("*", {})

    classes = []
    for cls in sorted(g.subjects(RDF.type, OWL.Class)):
        if not isinstance(cls, URIRef):
            continue
        parent = g.value(cls, RDFS.subClassOf)
        classes.append(
            {
                "id": curie(cls),
                "label": _label(g, cls, "en", RDFS.label),
                "label_pt": _label(g, cls, "pt", RDFS.label),
                "description": _label(g, cls, "en", RDFS.comment),
                "subclass_of": curie(parent) if parent else None,
                "table": _text(g, cls, TABUSH.table),
                "id_column": _text(g, cls, TABUSH.idColumn),
                "label_column": _text(g, cls, TABUSH.labelColumn),
                "status": _text(g, cls, TABUSH.status) or "published",
            }
        )

    out_tables = {}
    for cls in classes:
        name = cls["table"]
        if not name:
            continue
        facts = tables.get(name, {})
        meaning = described.get(name, {}) | {
            k: v for k, v in wildcard.items() if k not in described.get(name, {})
        }
        types = facts.get("columns", {c: None for c in meaning})
        out_tables[name] = {
            "class": cls["id"],
            "rows": facts.get("rows"),
            "source": facts.get("source"),
            "snapshot_date": facts.get("snapshot_date"),
            "columns": [
                {"name": col, "type": typ, **_column_dict(meaning.get(col))}
                for col, typ in types.items()
            ],
        }

    relations = []
    for prop in sorted(g.subjects(RDF.type, OWL.ObjectProperty)):
        relations.append(
            {
                "id": curie(prop),
                "predicate": _text(g, prop, TABUSH.predicate),
                "label": _label(g, prop, "en", RDFS.label),
                "domain": curie(g.value(prop, RDFS.domain)),
                "range": _range(g, prop),
                "standard": curie(g.value(prop, RDFS.subPropertyOf))
                if g.value(prop, RDFS.subPropertyOf)
                else None,
                "description": _label(g, prop, "en", RDFS.comment),
                "status": _text(g, prop, TABUSH.status) or "published",
            }
        )

    cdf = concepts(g)
    schemes = []
    for scheme in sorted(g.subjects(RDF.type, SKOS.ConceptScheme)):
        sid = curie(scheme)
        members = cdf[cdf["scheme"] == sid]
        members = members.astype(object).where(members.notna(), None)  # NaN is not JSON
        schemes.append(
            {
                "id": sid,
                "label": _label(g, scheme, "en"),
                "description": _label(g, scheme, "en", SKOS.definition),
                "codes": _text(g, scheme, TABUSH.codes),
                "concepts": [
                    {
                        k: v
                        for k, v in {
                            "id": r.concept_id,
                            "notation": r.notation,
                            "label": r.label_en,
                            "label_pt": r.label_pt,
                            "alt": list(r.alt_labels) or None,
                            "broader": r.broader,
                        }.items()
                        if v is not None
                    }
                    for r in members.itertuples()
                ],
            }
        )

    return {"classes": classes, "tables": out_tables, "relations": relations, "schemes": schemes}


def _column_dict(col: Column | None) -> dict[str, Any]:
    if col is None:
        return {}
    return {
        k: v
        for k, v in {
            "label": col.label,
            "description": col.description,
            "unit": col.unit,
            "coded_by": col.coded_by,
        }.items()
        if v is not None
    }
