import { useState } from "react";
import { Card } from "../ui/Card";
import { Count } from "../ui/Count";
import { LABEL, PROVIDERS, DEFAULT_CAP, useSpend } from "../lib/spend";

const fmt = (n: number) => new Intl.NumberFormat("en", { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);

/** Tokens used today across OpenAI, Jev and Perplexity, against a daily cap. At the cap the paid routes pause. */
export function SpendWidget() {
  const { today, total, cap, setCap, over } = useSpend();
  const [draft, setDraft] = useState("");
  const pct = Math.min(100, (total / cap) * 100);

  const commit = () => {
    const n = Number.parseInt(draft.replace(/[,_\s]/g, ""), 10);
    if (Number.isFinite(n) && n >= 1000) setCap(n);
    setDraft("");
  };

  return (
    <Card title="Token spend" meta={over ? "paused until tomorrow" : "today"}>
      <div className="spend">
        <div className="spend-total">
          <span className="big"><Count value={total} format={(n) => new Intl.NumberFormat("en").format(n)} /></span>
          <span className="muted">of {fmt(cap)} tokens</span>
        </div>
        <div className="meter" role="img" aria-label={`${Math.round(pct)} percent of today's cap used`} data-over={over || undefined}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <ul className="spend-list">
          {PROVIDERS.map((p) => {
            const [i, o] = today.p[p] ?? [0, 0];
            return (
              <li key={p}>
                <span>{LABEL[p]}</span>
                <span className="num muted">{fmt(i)} in · {fmt(o)} out</span>
              </li>
            );
          })}
        </ul>
        {over ? <p className="spend-note">The cap is reached, so the dashboard is using free sources and built-in content until tomorrow. Raise the cap to continue.</p> : null}
        <form className="cap-form" onSubmit={(e) => { e.preventDefault(); commit(); }}>
          <label htmlFor="cap" className="muted">Daily cap</label>
          <input id="cap" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={fmt(cap)} aria-label="Daily token cap" />
          <button className="btn" type="submit" disabled={!draft.trim()}>Set</button>
          {cap !== DEFAULT_CAP ? <button className="btn ghost" type="button" onClick={() => setCap(DEFAULT_CAP)}>Reset</button> : null}
        </form>
      </div>
    </Card>
  );
}
