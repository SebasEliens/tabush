import { openDataUrl } from "./db";

// The compiled ontology and taxonomy (semantic/*.ttl -> data/open/semantic_model.json),
// written by `uv run python -m tabush.semantic.publish`.

export interface ModelColumn {
  name: string;
  type: string | null;
  label?: string;
  description?: string;
  unit?: string;
  coded_by?: string;
}

export interface ModelTable {
  class: string | null;
  description?: string;
  rows: number;
  source?: string;
  snapshot_date?: string;
  columns: ModelColumn[];
}

export interface ModelConcept {
  id: string;
  notation?: string;
  label: string;
  label_pt?: string;
  alt?: string[];
  broader?: string;
}

export interface ModelScheme {
  id: string;
  label: string;
  description?: string;
  codes?: string;
  concepts: ModelConcept[];
}

export interface ModelRelation {
  id: string;
  predicate: string;
  label: string;
  domain: string;
  range: string[];
  standard?: string;
  description?: string;
  status: string;
}

export interface ModelClass {
  id: string;
  label: string;
  description?: string;
  subclass_of?: string;
  table?: string;
  status: string;
}

export interface SemanticModel {
  classes: ModelClass[];
  tables: Record<string, ModelTable>;
  relations: ModelRelation[];
  schemes: ModelScheme[];
  generated_at: string;
  crs: string;
}

export interface Example {
  id: string;
  question: string;
  concepts: string[];
  sql: string;
}

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(openDataUrl(file));
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) {
    throw new Error(`${file} not found. Build it with: uv run python -m tabush.semantic.publish`);
  }
  return (await res.json()) as T;
}

export const fetchModel = () => getJson<SemanticModel>("semantic_model.json");
export const fetchExamples = async () => (await getJson<{ examples: Example[] }>("examples.json")).examples;

/** Tables a query reads, so the answer can cite their source and snapshot date. */
export function tablesIn(sql: string, model: SemanticModel): string[] {
  return Object.keys(model.tables).filter((t) => new RegExp(`\\b${t}\\b`, "i").test(sql));
}
