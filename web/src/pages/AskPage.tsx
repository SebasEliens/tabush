import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Database as DatabaseIcon, MessageSquareText, Network, Sparkles, Tags } from "lucide-react";
import { ask, llmAvailable, MODEL, newConversation, type Conversation, type Step } from "../ask/agent";
import { openDatabase, type Database, type QueryResult } from "../ask/db";
import { fetchExamples, fetchModel, tablesIn, type Example, type SemanticModel } from "../ask/semantic";
import { config } from "../config";
import { dateLong } from "../format";
import { Badge, Button, Callout, Card, Disclosure, EmptyState, Eyebrow, Skeleton } from "../ui";

interface Turn {
  question: string;
  steps: Step[];
  worked?: boolean;
  pending: boolean;
  error?: string;
}

type LlmState = "checking" | "on" | "off";

const DATA_TABLES = ["rural_properties", "indigenous_lands", "protected_areas", "municipalities", "nodes", "edges", "concepts"];

export function AskPage() {
  const [model, setModel] = useState<SemanticModel>();
  const [examples, setExamples] = useState<Example[]>([]);
  const [db, setDb] = useState<Database>();
  const [loadError, setLoadError] = useState<string>();
  const [llm, setLlm] = useState<LlmState>(llmAvailable() ? "checking" : "off");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const conv = useRef<Conversation>(newConversation());
  const busy = turns.some((t) => t.pending);

  useEffect(() => {
    Promise.all([fetchModel(), fetchExamples()])
      .then(([m, ex]) => {
        setModel(m);
        setExamples(ex);
        return openDatabase(DATA_TABLES.filter((t) => t in m.tables));
      })
      .then(setDb)
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (!llmAvailable()) return;
    // The proxy answers 503 when no API key is configured.
    fetch(new URL(`${config.llmUrl.replace(/\/$/, "")}/v1/models?limit=1`, window.location.href))
      .then((r) => setLlm(r.ok ? "on" : "off"))
      .catch(() => setLlm("off"));
  }, []);

  const update = (i: number, f: (t: Turn) => Turn) => setTurns((ts) => ts.map((t, j) => (j === i ? f(t) : t)));

  async function runWorked(ex: Example) {
    if (!db) return;
    const i = turns.length;
    setTurns((ts) => [...ts, { question: ex.question, steps: [], worked: true, pending: true }]);
    const step: Step = { kind: "sql", purpose: "Reference query for this worked example", sql: ex.sql };
    try {
      const result = await db.query(ex.sql);
      update(i, (t) => ({ ...t, steps: [{ ...step, result }], pending: false }));
    } catch (e) {
      update(i, (t) => ({ ...t, steps: [{ ...step, error: String(e) }], pending: false }));
    }
  }

  async function submit(q: string) {
    if (!db || !model || !q.trim() || busy) return;
    if (llm !== "on") {
      const ex = examples.find((e) => e.question === q);
      if (ex) runWorked(ex);
      return;
    }
    const i = turns.length;
    setTurns((ts) => [...ts, { question: q, steps: [], pending: true }]);
    setQuestion("");
    try {
      await ask(q, conv.current, { db, model, examples }, (step) => update(i, (t) => ({ ...t, steps: [...t.steps, step] })));
      update(i, (t) => ({ ...t, pending: false }));
    } catch (e) {
      conv.current = newConversation(); // a half-finished exchange can't be continued
      update(i, (t) => ({ ...t, pending: false, error: e instanceof Error ? e.message : String(e) }));
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(question);
  };

  return (
    <div className="page ask">
      <div className="page-head">
        <div>
          <h1>Ask the data</h1>
          <p>Ask in plain Portuguese or English. Answers come from open land tenure data, with every query and source shown.</p>
        </div>
      </div>

      <div className="ask__layout">
        <div className="ask__main stack-4">
          {loadError && (
            <Callout tone="warning" title="The open data isn't published yet">
              {loadError}
            </Callout>
          )}
          {llm === "off" && !loadError && (
            <Callout tone="info" title="The assistant is not connected">
              Set <code>ANTHROPIC_API_KEY</code> in <code>.env</code> and restart the web server to ask your own questions. The worked
              examples below still run their reference query on the live data.
            </Callout>
          )}

          <Card>
            <form className="ask__form stack-3" onSubmit={onSubmit}>
              <label className="ask__label" htmlFor="ask-question">Your question</label>
              <textarea
                id="ask-question"
                className="ask__input"
                rows={2}
                value={question}
                placeholder={llm === "on" ? "e.g. Which family farms in Canguçu overlap another CAR claim?" : "Connect the assistant to ask your own question"}
                disabled={llm !== "on" || !db}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(question);
                  }
                }}
              />
              <div className="row-between">
                <span className="ask__hint">
                  {db ? (
                    <>
                      <DatabaseIcon size={14} aria-hidden /> DuckDB in your browser · {db.tables.length} tables
                      {db.spatial ? " · spatial on" : ""}
                    </>
                  ) : loadError ? null : (
                    "Opening the data…"
                  )}
                </span>
                <Button type="submit" variant="primary" icon={Sparkles} disabled={llm !== "on" || !db || busy || !question.trim()}>
                  Ask
                </Button>
              </div>
            </form>
            {examples.length > 0 && (
              <div className="ask__examples">
                <Eyebrow>{llm === "on" ? "Try a question" : "Worked examples"}</Eyebrow>
                <div className="filters">
                  {examples.map((ex) => (
                    <button key={ex.id} className="chip" disabled={!db || busy} onClick={() => (llm === "on" ? submit(ex.question) : runWorked(ex))}>
                      {ex.question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {turns.length === 0 && !loadError && (
            <Card>
              <EmptyState icon={MessageSquareText} title="No questions yet">
                The assistant maps your words onto the taxonomy, writes SQL, runs it here in the browser and explains the result.
              </EmptyState>
            </Card>
          )}

          {[...turns].reverse().map((t, idx) => (
            <TurnCard key={turns.length - idx} turn={t} model={model} />
          ))}
        </div>

        <aside className="ask__aside stack-4" aria-label="Semantic layer">
          {model ? <SemanticLayerCard model={model} /> : !loadError && <Card><Skeleton height={160} /></Card>}
        </aside>
      </div>
    </div>
  );
}

function TurnCard({ turn, model }: { turn: Turn; model?: SemanticModel }) {
  const sqlSteps = turn.steps.filter((s): s is Extract<Step, { kind: "sql" }> => s.kind === "sql");
  const answer = turn.steps.find((s): s is Extract<Step, { kind: "answer" }> => s.kind === "answer");
  const used = model ? [...new Set(sqlSteps.flatMap((s) => tablesIn(s.sql, model)))] : [];
  return (
    <Card
      title={turn.question}
      description={turn.worked ? "Worked example: the reference query and its live result" : `Answered by ${MODEL}`}
      actions={turn.pending ? <Badge tone="info">Working…</Badge> : turn.worked ? <Badge tone="neutral">Worked example</Badge> : undefined}
    >
      <div className="stack-4">
        {answer && <AnswerText text={answer.text} />}
        {turn.error && <Callout tone="danger" title="The question could not be answered">{turn.error}</Callout>}
        {turn.pending && !answer && <Skeleton height={14} width="60%" />}
        {sqlSteps.length > 0 && (
          <div>
            {sqlSteps.map((s, i) => (
              <Disclosure
                key={i}
                defaultOpen={turn.worked || i === sqlSteps.length - 1}
                title={<span className="ask__step-title"><DatabaseIcon size={14} aria-hidden />{s.purpose || `Query ${i + 1}`}</span>}
                meta={s.error ? "failed" : s.result ? `${plural(s.result.rowCount, "row")} · ${s.result.ms} ms` : undefined}
              >
                <pre className="ask__sql"><code>{s.sql}</code></pre>
                {s.error && <Callout tone="warning" title="Query failed">{s.error}</Callout>}
                {s.result && <ResultTable result={s.result} />}
              </Disclosure>
            ))}
          </div>
        )}
        {used.length > 0 && model && (
          <div className="ask__sources">
            <Eyebrow>Sources</Eyebrow>
            <ul>
              {used.map((t) => {
                const m = model.tables[t];
                return (
                  <li key={t}>
                    <code>{t}</code> · {m.source ?? "derived"}
                    {m.snapshot_date ? `, snapshot ${dateLong(m.snapshot_date)}` : ""}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function AnswerText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="ask__answer stack-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s/.test(l))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s/, ""))}</li>)}</ul>;
        }
        const sources = /^sources?:|^fontes?:/i.test(b);
        return <p key={i} className={sources ? "ask__answer-sources" : undefined}>{inline(b)}</p>;
      })}
    </div>
  );
}

/** **bold** and `code`, nothing else. */
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) =>
    part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : part,
  );
}

function ResultTable({ result }: { result: QueryResult }) {
  const shown = result.rows.slice(0, 20);
  const numeric = (c: string) => shown.length > 0 && shown.every((r) => r[c] == null || typeof r[c] === "number");
  return (
    <div className="ask__result">
      <table className="ui-table">
        <thead>
          <tr>{result.columns.map((c) => <th key={c} className={numeric(c) ? "num" : undefined}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>
              {result.columns.map((c) => (
                <td key={c} className={numeric(c) ? "num" : undefined}>{fmt(r[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rowCount > shown.length && <p className="ask__more">Showing {shown.length} of {result.rowCount} rows</p>}
    </div>
  );
}

const plural = (n: number, word: string) => `${n.toLocaleString("en-GB")} ${word}${n === 1 ? "" : "s"}`;

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-GB") : v.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function SemanticLayerCard({ model }: { model: SemanticModel }) {
  const coded = model.schemes.filter((s) => s.codes);
  const planned = model.schemes.filter((s) => !s.codes);
  const tables = Object.entries(model.tables);
  return (
    <Card title="Semantic layer" description="The taxonomy and ontology the assistant reasons with, compiled from semantic/*.ttl.">
      <div className="stack-3">
        <Disclosure title={<span className="ask__step-title"><DatabaseIcon size={14} aria-hidden />Tables</span>} meta={`${tables.length}`} defaultOpen>
          <ul className="ask__list">
            {tables.map(([name, t]) => (
              <li key={name}>
                <code>{name}</code>
                <span className="ask__muted">{plural(t.rows, "row")}{t.class ? ` · ${t.class}` : ""}</span>
              </li>
            ))}
          </ul>
        </Disclosure>
        <Disclosure title={<span className="ask__step-title"><Network size={14} aria-hidden />Relations</span>} meta={`${model.relations.length}`}>
          <ul className="ask__list">
            {model.relations.map((r) => (
              <li key={r.id}>
                <span><strong>{r.label}</strong> <code>{r.predicate}</code></span>
                <span className="ask__muted">
                  {r.domain} → {r.range.join(" | ")}
                  {r.standard ? ` · ${r.standard}` : ""}
                  {r.status === "planned" ? " · planned" : ""}
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
        {[...coded, ...planned].map((s) => (
          <Disclosure
            key={s.id}
            title={<span className="ask__step-title"><Tags size={14} aria-hidden />{s.label}</span>}
            meta={s.codes ? `${s.concepts.length}` : "not yet in data"}
          >
            {s.codes && <p className="ask__muted">Codes <code>{s.codes}</code></p>}
            <ul className="ask__list">
              {s.concepts.map((c) => (
                <li key={c.id} className={c.broader ? "ask__narrower" : undefined}>
                  <span>
                    {c.notation && <code>{c.notation}</code>} {c.label}
                  </span>
                  {(c.label_pt || c.alt) && (
                    <span className="ask__muted">{[c.label_pt, ...(c.alt ?? [])].filter(Boolean).join(" · ")}</span>
                  )}
                </li>
              ))}
            </ul>
          </Disclosure>
        ))}
        <p className="ask__muted">Model compiled {dateLong(model.generated_at.slice(0, 10))} · geometry in {model.crs}</p>
      </div>
    </Card>
  );
}
