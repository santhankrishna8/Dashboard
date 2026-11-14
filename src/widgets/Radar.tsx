import { useState } from "react";
import { z } from "zod";
import { Card, Async, RefreshBtn } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { getJson, useFeed } from "../lib/feed";
import { ago, compact } from "../lib/fmt";

const Model = z.object({
  id: z.string(),
  name: z.string(),
  created: z.number(),
  context_length: z.number().nullable().optional(),
  pricing: z.object({ prompt: z.string().optional(), completion: z.string().optional() }).optional(),
  architecture: z.object({ output_modalities: z.array(z.string()).optional() }).optional(),
});
const Models = z.object({ data: z.array(z.unknown()) });

/** Labs worth watching, keyed by the vendor prefix OpenRouter puts on every model id. The rest is long-tail noise. */
const LABS: Record<string, { label: string; group: "Anthropic" | "OpenAI" | "Google" | "Open" }> = {
  anthropic: { label: "Anthropic", group: "Anthropic" },
  openai: { label: "OpenAI", group: "OpenAI" },
  google: { label: "Google", group: "Google" },
  "x-ai": { label: "xAI", group: "Open" },
  deepseek: { label: "DeepSeek", group: "Open" },
  "meta-llama": { label: "Meta", group: "Open" },
  qwen: { label: "Qwen", group: "Open" },
  mistralai: { label: "Mistral", group: "Open" },
  moonshotai: { label: "Moonshot", group: "Open" },
  "z-ai": { label: "Z.ai", group: "Open" },
  minimax: { label: "MiniMax", group: "Open" },
  nvidia: { label: "NVIDIA", group: "Open" },
};
const FILTERS = ["All", "Anthropic", "OpenAI", "Google", "Open"] as const;
type Filter = (typeof FILTERS)[number];
const WEEK = 7 * 24 * 3600_000;

/** Dollars per million tokens, or null when the model doesn't publish a price. */
const perM = (v?: string): number | null => {
  const n = v === undefined ? NaN : Number(v) * 1e6;
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const usd = (n: number | null): string => (n === null ? "–" : n === 0 ? "free" : `$${+n.toFixed(n < 1 ? 2 : 1)}`);

async function load() {
  const raw = Models.parse(await getJson("https://openrouter.ai/api/v1/models"));
  const byBase = new Map<string, z.infer<typeof Model>>();
  for (const item of raw.data) {
    const m = Model.safeParse(item);
    if (!m.success) continue;
    const [base = "", variant] = m.data.id.split(":");
    const vendor = base.split("/")[0] ?? "";
    if (!LABS[vendor] || variant === "batch") continue;
    if (m.data.architecture?.output_modalities && !m.data.architecture.output_modalities.includes("text")) continue;
    // ":free" and other variants share the base model's row; a model that only exists as a variant still shows.
    if (!byBase.has(base) || variant === undefined) byBase.set(base, m.data);
  }
  return [...byBase.values()]
    .sort((a, b) => b.created - a.created)
    .slice(0, 60)
    .map((m) => {
      const vendor = m.id.split("/")[0] ?? "";
      const lab = LABS[vendor];
      return {
        id: m.id,
        name: m.name.replace(/^[^:]+:\s*/, ""),
        lab: lab?.label ?? vendor,
        group: lab?.group ?? "Open",
        t: m.created * 1000,
        input: perM(m.pricing?.prompt),
        output: perM(m.pricing?.completion),
        ctx: m.context_length ?? 0,
      };
    });
}

/** The newest models from the labs that matter, with price and context window. Data is OpenRouter's public catalogue. */
export function RadarWidget() {
  const [filter, setFilter] = useState<Filter>("All");
  const feed = useFeed("radar", load, 60 * 60_000);
  const now = Date.now();
  return (
    <Card title="AI model radar" meta="newest models · $ per 1M tokens in / out" actions={<RefreshBtn feed={feed} label="AI model radar" />}>
      <Async feed={feed} rows={5}>
        {(rows) => {
          const shown = filter === "All" ? rows : rows.filter((r) => r.group === filter);
          return (
            <>
              <div className="chips" role="group" aria-label="Filter by lab">
                {FILTERS.map((f) => (
                  <button key={f} aria-pressed={f === filter} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
              <Paged
                items={shown}
                rowH={36}
                empty={<p className="stale">No recent {filter} models in the catalogue.</p>}
                render={(m) => (
                  <div className="fx-row radar" key={m.id} title={`${m.id} · released ${new Date(m.t).toLocaleDateString()}`}>
                    <span className="who">
                      <a className="plain" href={`https://openrouter.ai/${m.id.split(":")[0]}`} target="_blank" rel="noopener noreferrer"><strong>{m.name}</strong></a>
                      {now - m.t < WEEK ? <span className="tag">new</span> : null}
                      <span className="muted">{m.lab}</span>
                    </span>
                    <span className="num rp">{usd(m.input)} / {usd(m.output)}</span>
                    <span className="num rc">{m.ctx ? compact(m.ctx) : "–"}</span>
                    <span className="muted ago">{ago(m.t)}</span>
                  </div>
                )}
              />
            </>
          );
        }}
      </Async>
    </Card>
  );
}
