# Semantic layer

The taxonomy and ontology that describe the open data in `data/open/`, and the golden
questions that test the talk-to-the-data assistant. Design: [docs/research/talk-to-the-data.md](../docs/research/talk-to-the-data.md).

| File | What |
|---|---|
| `taxonomy.ttl` | SKOS concept schemes. `skos:notation` is the value stored in the data; `tabush:codes` names the column. English and Portuguese labels, synonyms, AGROVOC links. |
| `ontology.ttl` | OWL classes and relations (GeoSPARQL, PROV-O, LADM terms), bound to tables and columns with `tabush:table`, `tabush:column`, `tabush:predicate`, `tabush:codedBy`. |
| `examples.json` | Golden questions with reference SQL. Worked examples in the app, few-shot examples for the assistant, regression tests. |

```sh
uv run python -m tabush.ingest.municipalities --municipio 4304507 --municipio 1507300
uv run python -m tabush.semantic.publish   # data/open/: GeoParquet 2.0, nodes, edges, concepts, semantic_model.json
uv run pytest tests/test_semantic.py       # integrity and golden questions on a synthetic fixture
```

When you add a coded column, add its scheme here first; the tests fail if the data holds a
value the taxonomy doesn't define. When you add a relation, add it to the ontology; edge
predicates must be ontology relations.
