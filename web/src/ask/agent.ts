import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import type { Database, QueryResult } from "./db";
import type { Example, SemanticModel } from "./semantic";

// Talk to the data: Claude turns a question into DuckDB SQL guided by the semantic model,
// runs it in the browser through the run_sql tool, reads the result and explains it.
// Requests go to config.llmUrl, a proxy that adds the API key server-side.

export const MODEL = "claude-opus-5-5";
const MAX_ROUNDS = 8;
const ROWS_TO_MODEL = 50;

export type Step =
  | { kind: "sql"; purpose: string; sql: string; result?: QueryResult; error?: string }
  | { kind: "answer"; text: string };

export function llmAvailable(): boolean {
  return Boolean(config.llmUrl);
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  client ??= new Anthropic({
    baseURL: new URL(config.llmUrl, window.location.href).toString().replace(/\/$/, ""),
    apiKey: "added-by-proxy", // the proxy replaces it; no real key is ever in the browser
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
  });
  return client;
}

const RUN_SQL: Anthropic.Beta.BetaTool = {
  name: "run_sql",
  description:
    "Run one read-only DuckDB SELECT query on the open data tables and get back the column names, " +
    "the first rows and the total row count. Use only the tables and columns in the semantic model. " +
    "Call it as many times as needed: to look up values, then to answer.",
  input_schema: {
    type: "object",
    properties: {
      purpose: { type: "string", description: "One short sentence on what this query finds, shown to the user." },
      sql: { type: "string", description: "A single DuckDB SELECT (or WITH ... SELECT) statement." },
    },
    required: ["purpose", "sql"],
    additionalProperties: false,
  },
  strict: true,
};

function systemPrompt(model: SemanticModel, examples: Example[]): string {
  return `You answer questions about land tenure in Brazil from open public data, for people such as credit officers, journalists, researchers and community organisations.

You work through a semantic layer: an ontology (classes, relations) and a taxonomy (SKOS concept schemes) bound to Parquet tables that you query with DuckDB SQL through the run_sql tool. The data model is below as JSON.

How to answer
- Map the words in the question onto the model first. Find the concept whose label, Portuguese label or synonym (alt) matches, and filter on its notation in the column the scheme codes. For example "family farm" means size_class = 'small' AND property_type = 'IRU' (tx:small-property, tx:private-rural-property). Never guess a column or a code that is not in the model.
- Entities are rows of their table; relations are rows of edges (subject, predicate, object), where node ids are '<table>:<source_id>'. Join edges to a table with e.g. e.object = 'indigenous_lands:' || il.source_id. Use WITH RECURSIVE for multi-hop paths.
- Leave out cancelled CAR records (status = 'CA') unless the question is about them.
- The concepts table holds the taxonomy; join it to show readable labels instead of codes.
- Geometry columns are in ${model.crs}. Prefer the precomputed area_ha, overlap_ha and overlap_pct columns. If you need spatial functions, compute areas in hectares with ST_Area_Spheroid(geometry) / 10000. Never return raw geometry.
- Keep result sets small: aggregate, or ORDER BY and LIMIT 20 for lists.
- If a query fails, read the error, fix the query and try again.
- If the data cannot answer the question, say so plainly and say what data would. For example, owners are not published in CAR, and land use (MapBiomas) is not ingested yet.

How to write the answer
- Answer in the language of the question (Portuguese or English).
- Lead with the direct answer and its numbers, in one or two sentences. Then give a short interpretation: what it means and how sure we can be (cite confidence where it applies; CAR boundaries are self-declared, and a small overlap may be a drawing error rather than a conflict).
- End with a "Sources:" line naming each table you used with its source and snapshot date from the model.
- Plain text with short paragraphs or a short list. No tables: the user already sees each query's result.

Worked examples (question and reference SQL):
${examples.map((e) => `Q: ${e.question}\nSQL:\n${e.sql}`).join("\n\n")}

Semantic model:
${JSON.stringify(model)}`;
}

export interface Conversation {
  messages: Anthropic.Beta.BetaMessageParam[];
}

export const newConversation = (): Conversation => ({ messages: [] });

/** Ask one question in a conversation (follow-ups see earlier turns). Reports each step. */
export async function ask(
  question: string,
  conv: Conversation,
  ctx: { db: Database; model: SemanticModel; examples: Example[] },
  onStep: (step: Step) => void,
  signal?: AbortSignal,
): Promise<void> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: systemPrompt(ctx.model, ctx.examples), cache_control: { type: "ephemeral" } },
  ];
  conv.messages.push({ role: "user", content: question });

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await getClient().beta.messages.create(
      {
        model: MODEL,
        max_tokens: 16000,
        system,
        tools: [RUN_SQL],
        messages: conv.messages,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal },
    );
    conv.messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "refusal") {
      onStep({ kind: "answer", text: "The assistant declined to answer this question." });
      return;
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (calls.length === 0) {
      onStep({ kind: "answer", text: text || "No answer was returned." });
      return;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = call.input as { purpose?: string; sql?: string };
      const step: Step = { kind: "sql", purpose: input.purpose ?? "", sql: input.sql ?? "" };
      try {
        if (call.name !== "run_sql" || typeof input.sql !== "string") throw new Error("Unknown tool or missing sql");
        const result = await ctx.db.query(input.sql);
        onStep({ ...step, result });
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify({
            columns: result.columns,
            rows: result.rows.slice(0, ROWS_TO_MODEL),
            row_count: result.rowCount,
            truncated: result.rowCount > ROWS_TO_MODEL,
          }),
        });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        onStep({ ...step, error });
        results.push({ type: "tool_result", tool_use_id: call.id, content: error, is_error: true });
      }
    }
    conv.messages.push({ role: "user", content: results });
  }
  onStep({ kind: "answer", text: "Stopped after too many queries without an answer. Try a narrower question." });
}
