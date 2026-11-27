# Talk to the data: open files, a semantic layer and an LLM

*Design note · 27 Nov 2026 · prototype in `semantic/`, `src/tabush/semantic/` and the web app's "Ask the data" page*

## Bottom line

The land tenure data is published as **plain open files**: GeoParquet 2.0 layers plus Parquet node and edge tables. A browser reads them directly with **DuckDB-WASM**, so no database or graph server runs. On top of the files sits a **semantic layer**: a SKOS taxonomy and an OWL ontology in Turtle, bound to the tables and columns. An **LLM** (Claude) uses that layer to turn a question in Portuguese or English into SQL. It runs the query in the browser, then explains the result and cites the source and snapshot date of every table used.

The semantic layer is what makes the answers trustworthy. "Family farm" is defined once (small property, private rural property), so the model doesn't guess which column means it. The same layer documents the open data for people and for other tools.

## The three layers

| Layer | What | Where |
|---|---|---|
| Open data | GeoParquet 2.0 per layer (Parquet's native `GEOMETRY` type, EPSG:4674): CAR properties, indigenous lands, protected areas, municipalities with Census 2022 population. The graph as tables: `nodes` (every entity) and `edges` (subject, predicate, object, with `source`, `snapshot_date`, `confidence`). `concepts` (the taxonomy). | `data/open/`, written by `uv run python -m tabush.semantic.publish` |
| Semantic layer | **Taxonomy** (`semantic/taxonomy.ttl`, SKOS). Each coded column has a concept scheme whose `skos:notation` is the stored value, with English and Portuguese labels, synonyms people use (`grilagem`, "family farm", "TI") and AGROVOC links. **Ontology** (`semantic/ontology.ttl`, OWL). Classes and relations built on GeoSPARQL (`sfOverlaps`, `sfWithin`, `sfIntersects`), PROV-O and LADM (ISO 19152) for parties and rights, with `tabush:table` / `tabush:column` / `tabush:codedBy` bindings to the files. | Compiled to `semantic_model.json` and `concepts.parquet` |
| Talk to the data | Claude (`claude-opus-5-5`, adaptive thinking, medium effort, server-side refusal fallback) gets the compiled model and the golden questions as context, plus one tool, `run_sql`. It can run several queries, fix failed ones and then answer. The page shows each query, its result, the answer and the sources. Only single `SELECT` statements run: DuckDB's own parser checks this with `json_serialize_sql`. | `web/src/ask/`, `web/src/pages/AskPage.tsx` |

Without an API key the page still works: the golden questions run as worked examples, showing their reference SQL and live result.

### Why no graph database

The questions that need a graph are short multi-hop paths: property overlaps property overlaps indigenous land, or later family to company to parcel to embargo. A recursive SQL query over `edges` handles them in milliseconds at this scale (golden question `overlap-chains-to-indigenous-land`). Keeping the graph as files means:

- **no server to run**, and the data can be fully open and cached on a CDN
- **any tool can read it**: DuckDB, pandas, QGIS, RustGIS, notebooks
- **the ontology stays the schema**: edge predicates must be ontology relations, and coded values must be taxonomy notations. `tests/test_semantic.py` enforces both.

The TypeDB schema in `schema/core.tql` stays as the record of the earlier plan. If a use case later needs reasoning (rule inference) or graph algorithms at national scale, TypeDB or Neo4j can load the same nodes and edges.

### GeoParquet 2.0

DuckDB writes the layers with `GEOPARQUET_VERSION 'V2'`: Parquet's native `GEOMETRY` logical type with the CRS on the column, and GeoParquet 2.0 metadata. Readers that don't know the type yet, such as DuckDB-WASM 1.32 (DuckDB 1.4), see WKB bytes. The page decodes them with the spatial extension. The GeoParquet project still advises 1.1 for production until tools catch up, so this choice should be revisited if a partner's tool can't read the files. Switching is one option in `write_geoparquet`.

Territories are clipped to the ones touching the pilot municipalities (6 indigenous lands, 7 protected areas), so all files together are about 13 MB, and DuckDB only fetches the parts a query needs.

## Reusing open source instead of building

Checked before building ([RustGIS review](rustgis-review.md) for background):

| Need | Choice | Why not something else |
|---|---|---|
| GIS front end | Keep our React + MapLibre app, and make the **files** the integration point | RustGIS browser plugins are sandboxed Rust/wasm that can only make small header-less GETs, so they can't call an LLM. Its SQL/DuckDB pane is desktop-only. RustGIS, QGIS and DuckDB can all open our files directly (nginx serves `/open/` with CORS). A RustGIS plugin or MCP skill built on `semantic_model.json` is a sensible later step. |
| Taxonomy format | **SKOS** + **AGROVOC** links (ids checked against agrovoc.fao.org), **MapBiomas** legend codes, **SNUC** categories | Standard, readable by any RDF tool and by FAO's own vocabularies |
| Ontology | **GeoSPARQL**, **PROV-O**, **LADM (ISO 19152)** terms | LADM is the land administration standard (party, right/restriction/responsibility, spatial unit). It has no official OWL namespace, so the mapping is in comments. |
| Query engine | **DuckDB** (Python, writing) and **DuckDB-WASM** (browser, reading) | Reads GeoParquet over HTTP range requests, and has recursive SQL and a spatial extension |
| Text-to-SQL | Our own ~200-line loop on the **Anthropic SDK** | **WrenAI** (Apache-2.0, MDL semantic layer, DuckDB) is the strongest open option but runs as a server. **Vanna** is a server-side RAG library. **Malloy** runs on DuckDB-WASM but asks the LLM to write a less common language. Our semantic model is close to WrenAI's MDL, so an exporter is cheap if we move server-side. |
| E2E specs | **playwright-bdd** (Gherkin in `features/` runs as Playwright tests) | No custom test runner |

## Earth observation embeddings: do they fit?

Embeddings such as Google's **AlphaEarth Foundations Satellite Embedding** dataset and Clay compress a year of satellite imagery into a short vector per pixel. AlphaEarth gives 64 dimensions at 10 m, annual from 2017, as COGs under CC-BY 4.0, mirrored on Source Cooperative with a GeoParquet index. Clay embeddings are generated per image chip by an open model.

**Where they help us**

1. **"Parcels like this one".** Average the embedding over each CAR polygon, then store it as a `FLOAT[64]` column in `rural_properties`. DuckDB can rank by `array_cosine_similarity` in the browser, so the assistant could get a `similar_parcels` tool. Credit officers would use this to find comparable farms. Insurers would use it to find farms exposed to the same hazard.
2. **Land use for the taxonomy without a raster stack.** A small classifier on embeddings, trained on MapBiomas labels, can fill a `land_use` column coded by the `tx:land-use` scheme that is already in the taxonomy. It is cheap to run per parcel. MapBiomas itself stays the authoritative source, and the embeddings fill gaps and give a per-parcel summary.
3. **Change detection.** The year-on-year distance between a parcel's embeddings flags large changes, such as clearing, new crops or flooding. It doesn't label them, but it shows where to look before PRODES/DETER or MapBiomas alerts arrive.

**Where they don't**

- They aren't evidence. A compliance flag must trace to a public record (CAR, FUNAI, IBAMA, PRODES), not to a learned vector, so embeddings can rank and suggest but not decide.
- They are opaque: dimensions have no meaning, so the LLM can't reason about them, only call a similarity tool.
- Cost: national coverage per parcel means sampling about 7 million CAR polygons from COGs. That's fine for the pilots, and a pipeline job nationally.

**Verdict:** a good fit for similarity search and land-use gap filling, and not part of this prototype. Next slice: an ingest that samples AlphaEarth for the pilot municipalities' parcels, stores the vector plus its year and source, and adds a `similar_parcels` tool and golden question. Compute it from the COGs with rasterio or xarray, not Earth Engine (CLAUDE.md: GEE is for prototyping only).

## Specify, implement, validate

This prototype pilots three practices for catching problems early without a person in the loop:

1. **Feature files as the spec.** `features/ask_the_data.feature` describes the behaviour in Gherkin. playwright-bdd runs each scenario against a production build (`npm run e2e`), with the Claude API stubbed so the agent loop, SDK and DuckDB run for real. The steps save screenshots to `web/e2e/screenshots/`, which serve as the PR's visual proof, and CI uploads them.
2. **Golden questions.** `semantic/examples.json` holds questions and reference SQL. The publish step runs each one and stores the expected answer next to it. pytest checks the answers on a synthetic fixture where they are known (`tabush.semantic.fixture`). The `@llm` scenarios (`npm run e2e:llm`) ask the real model and check that its answer contains the reference numbers and names its sources. Run them after changing the prompt, the taxonomy, the ontology or the model.
3. **Invariants on the data.** Every edge resolves to nodes and carries provenance. Every coded value is a taxonomy notation. Overlap shares are percentages. Layers are GeoParquet 2.0 in EPSG:4674.

## Open questions

- **LLM endpoint in production.** The dev and preview servers proxy `/llm` with the key from `.env`. The nginx image doesn't proxy yet, so `TABUSH_LLM_URL` should point at a gateway in a Brazil region (Bedrock in sa-east-1 if prompts must stay in Brazil).
- **Open licence and publishing.** Publish `data/open/` publicly (object storage + CDN) under the sources' terms. CAR, FUNAI/IBGE, CNUC and IBGE Census data are public, so check attribution requirements per source.
- **Ownership.** `tabush:Party` and `holdsRight` are defined but empty, because public CAR has no owners. Company registries (CNPJ, QSA) are public and could fill the "who is behind the land" chain without personal data. Individuals need partner consent and hashed CPF.
