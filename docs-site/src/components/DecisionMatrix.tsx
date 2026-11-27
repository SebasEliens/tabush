import { useId, useMemo, useState } from "react";

export interface Criterion {
  id: string;
  label: string;
  /** Default weight, 0 (ignore) to 5 (critical). */
  weight: number;
  hint?: string;
}

export interface Option {
  id: string;
  label: string;
  /** Score per criterion id, 1 (poor) to 5 (strong). */
  scores: Record<string, number>;
  note?: string;
}

interface Props {
  criteria: Criterion[];
  options: Option[];
  /** Option id that the decision record chose, marked in the ranking. */
  chosen?: string;
}

/**
 * Weighted decision matrix. Readers move the weights to see whether the
 * ranking still holds under their own priorities, which turns "we chose X"
 * into "X wins unless you care more about Y than Z".
 */
export default function DecisionMatrix({ criteria, options, chosen }: Props) {
  const uid = useId();
  const defaults = useMemo(() => Object.fromEntries(criteria.map((c) => [c.id, c.weight])), [criteria]);
  const [weights, setWeights] = useState<Record<string, number>>(defaults);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const ranked = options
    .map((o) => ({
      ...o,
      // Weighted mean, scaled to 0–100.
      score: Math.round(
        (criteria.reduce((sum, c) => sum + (o.scores[c.id] ?? 0) * weights[c.id], 0) / (5 * totalWeight)) * 100,
      ),
    }))
    .sort((a, b) => b.score - a.score);
  const changed = criteria.some((c) => weights[c.id] !== defaults[c.id]);

  return (
    <div className="tb-widget not-content" data-testid="decision-matrix">
      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend><h4>How much does each criterion matter?</h4></legend>
          {criteria.map((c) => (
            <div key={c.id} style={{ marginBottom: "0.6rem" }}>
              <label htmlFor={`${uid}-${c.id}`} style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <span>{c.label}</span>
                <output htmlFor={`${uid}-${c.id}`} style={{ fontVariantNumeric: "tabular-nums" }}>{weights[c.id]}</output>
              </label>
              <input
                id={`${uid}-${c.id}`}
                type="range"
                min={0}
                max={5}
                step={1}
                value={weights[c.id]}
                onChange={(e) => setWeights({ ...weights, [c.id]: Number(e.target.value) })}
                style={{ width: "100%", accentColor: "var(--sl-color-accent)" }}
                aria-describedby={c.hint ? `${uid}-${c.id}-hint` : undefined}
              />
              {c.hint && <div id={`${uid}-${c.id}-hint`} className="tb-muted">{c.hint}</div>}
            </div>
          ))}
          <button type="button" onClick={() => setWeights(defaults)} disabled={!changed} style={{ marginTop: "0.25rem" }}>
            Reset to the record's weights
          </button>
        </fieldset>
        <div aria-live="polite">
          <h4>Ranking</h4>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {ranked.map((o, i) => (
              <li key={o.id} style={{ marginBottom: "0.75rem" }} data-testid={`rank-${i + 1}`}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <strong>
                    {i + 1}. {o.label}
                    {o.id === chosen && <span className="tb-status" data-status="accepted" style={{ marginInlineStart: "0.5rem" }}>Chosen</span>}
                  </strong>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{o.score}</span>
                </div>
                <div style={{ background: "var(--sl-color-gray-6)", borderRadius: 999 }}>
                  <div className="tb-bar" style={{ width: `${o.score}%`, opacity: i === 0 ? 1 : 0.55 }} />
                </div>
                {o.note && <div className="tb-muted">{o.note}</div>}
              </li>
            ))}
          </ol>
          {changed && ranked[0]?.id !== chosen && chosen && (
            <p className="tb-muted" role="status">
              With these weights the recorded choice is no longer first. If these are the real priorities, the record needs revisiting.
            </p>
          )}
        </div>
      </div>
      <details style={{ marginTop: "1rem" }}>
        <summary>Raw scores (1 poor to 5 strong)</summary>
        <table>
          <thead>
            <tr>
              <th>Criterion</th>
              {options.map((o) => <th key={o.id}>{o.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => (
              <tr key={c.id}>
                <td>{c.label}</td>
                {options.map((o) => <td key={o.id}>{o.scores[c.id] ?? "–"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
