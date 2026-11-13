import { useState } from "react";
import { z } from "zod";
import { Card, Async, RefreshBtn } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { Row, ROW_H } from "../ui/Row";
import { getJson, useFeed } from "../lib/feed";
import { ago, host } from "../lib/fmt";
import { useSaved } from "../lib/store";
import { callApi } from "../lib/api";
import { useSynced } from "../lib/sync";
import { useSince } from "../lib/seen";

const NewsItem = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  tag: z.string(),
  t: z.number(),
  points: z.number().optional(),
  score: z.number().optional(),
  why: z.string().optional(),
});
const NewsList = z.object({ via: z.enum(["perplexity", "hn", "hn-jev"]), items: z.array(NewsItem) });
type News = z.infer<typeof NewsList>;

const Hits = z.object({
  hits: z.array(
    z.object({
      objectID: z.string(),
      title: z.string().nullish(),
      url: z.string().nullish(),
      points: z.number().nullish(),
      created_at_i: z.number(),
    }),
  ),
});

const AI = /\b(ai|a\.i\.|llms?|gpt\S*|openai|anthropic|claude|gemini|deepseek|mistral|llama|qwen|nvidia|copilot|agents?|neural|diffusion|transformers?|inference|machine learning|chatbot)\b/i;

const TAGS: [string, RegExp][] = [
  ["Business", /\b(raises?|funding|valuation|acquir\w*|ipo|billion|revenue|layoffs?)\b/i],
  ["Policy", /\b(regulat\w*|law|ban(ned)?|court|lawsuit|copyright|senate|eu)\b/i],
  ["Research", /\b(paper|arxiv|study|research|benchmark|dataset)\b/i],
  ["Model", /\b(gpt\S*|claude|gemini|llama|mistral|qwen|deepseek|model|release[sd]?)\b/i],
  ["Tool", /\b(agents?|cli|sdk|api|open[- ]source|library|framework|copilot|cursor|plugin)\b/i],
];
const tagOf = (title: string) => TAGS.find(([, re]) => re.test(title))?.[0] ?? "General";

/** Keyless fallback: Hacker News stories from the last 3 days, ranked by points and recency. */
async function fromHN(): Promise<News> {
  const since = Math.floor(Date.now() / 1000) - 3 * 86_400;
  const queries = ["LLM", "OpenAI", "Anthropic", "AI model", "AI agent"];
  const pages = await Promise.all(
    queries.map((q) =>
      getJson(
        `https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=25&query=${encodeURIComponent(q)}&numericFilters=${encodeURIComponent(`created_at_i>${since},points>20`)}`,
      ).then((j) => Hits.parse(j).hits),
    ),
  );
  const seen = new Map<string, News["items"][number]>();
  for (const h of pages.flat()) {
    if (!h.title || !AI.test(h.title) || seen.has(h.objectID)) continue;
    seen.set(h.objectID, {
      id: `hn-${h.objectID}`,
      title: h.title,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      tag: tagOf(h.title),
      t: h.created_at_i * 1000,
      points: h.points ?? 0,
    });
  }
  const hours = (t: number) => (Date.now() - t) / 3_600_000;
  const rank = (i: News["items"][number]) => (i.points ?? 0) / Math.pow(hours(i.t) + 4, 0.8);
  return { via: "hn", items: [...seen.values()].sort((a, b) => rank(b) - rank(a)).slice(0, 30) };
}

const Verdicts = z.object({ results: z.array(z.object({ id: z.string(), tag: z.string(), fit: z.number() })) });
const JUDGED = "sd:judged";
type Judged = Record<string, { tag: string; fit: number }>;

const readJudged = (): Judged => {
  try {
    return JSON.parse(localStorage.getItem(JUDGED) ?? "{}") as Judged;
  } catch {
    return {};
  }
};

/**
 * Jev reads each headline once: verdicts are remembered by story id, so a refresh only pays for stories it hasn't seen.
 * If the route isn't configured, the list comes back unchanged.
 */
async function withJev(list: News, token: () => Promise<string | null>, hint: string): Promise<News> {
  const known = readJudged();
  const fresh = list.items.filter((i) => !known[i.id]).slice(0, 40);
  if (fresh.length > 0) {
    const res = await callApi("/api/judge", token, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: fresh.map((i) => ({ id: i.id, title: i.title })), ...(hint ? { hint } : {}) }),
    });
    if (!res) return list;
    const parsed = Verdicts.safeParse(await res.json().catch(() => null));
    if (!parsed.success) return list;
    for (const v of parsed.data.results) known[v.id] = { tag: v.tag, fit: v.fit };
    try {
      const keep = new Set(list.items.map((i) => i.id));
      localStorage.setItem(JUDGED, JSON.stringify(Object.fromEntries(Object.entries(known).filter(([id]) => keep.has(id)))));
    } catch {
      /* ignore */
    }
  }
  const scored = list.items.map((i) => (known[i.id] ? { ...i, tag: known[i.id]?.tag ?? i.tag, score: known[i.id]?.fit } : i));
  if (scored.every((i) => i.score === undefined)) return list;
  // Drop what Jev rates as not useful to you, but never leave the card nearly empty.
  const kept = scored.filter((i) => (i.score ?? 1) >= 0.34);
  const items = (kept.length >= 10 ? kept : scored).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return { via: "hn-jev", items };
}

export function NewsWidget() {
  const { token, items: saved } = useSaved();
  const [dismissed, setDismissed] = useSynced<{ id: string; title: string }[]>("sd:dismissed", []);
  const [tag, setTag] = useState("All");
  const since = useSince("news");

  // What you saved and what you hid becomes extra context for Jev's rubric, so new stories are scored with your taste.
  const liked = saved.filter((s) => s.kind === "news" || s.kind === "repo").slice(0, 8).map((s) => s.title);
  const hint = [
    liked.length > 0 ? `They saved items like: ${liked.join("; ")}.` : "",
    dismissed.length > 0 ? `They hid items like: ${dismissed.slice(-8).map((d) => d.title).join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 690);

  const feed = useFeed<News>(
    "news",
    async () => {
      const res = await callApi("/api/news", token);
      if (res) {
        const parsed = NewsList.safeParse(await res.json().catch(() => null));
        if (parsed.success) return parsed.data;
      }
      return withJev(await fromHN(), token, hint);
    },
    2 * 3_600_000,
  );

  const hidden = new Set(dismissed.map((d) => d.id));
  const visible = feed.data ? feed.data.items.filter((n) => !hidden.has(n.id)) : [];
  const tags = ["All", ...new Set(visible.map((n) => n.tag))];
  const active = tags.includes(tag) ? tag : "All";
  const shown = active === "All" ? visible : visible.filter((n) => n.tag === active);
  const newCount = visible.filter((n) => n.t > since).length;

  return (
    <Card
      title="AI news"
      meta={feed.data ? `${feed.data.via === "perplexity" ? "Perplexity + Jev" : feed.data.via === "hn-jev" ? "Hacker News + Jev" : "Hacker News"} · ${feed.updatedAt ? ago(feed.updatedAt) : ""}${newCount > 0 ? ` · ${newCount} new` : ""}` : undefined}
      actions={<RefreshBtn feed={feed} label="AI news" />}
    >
      <Async feed={feed} rows={5}>
        {() => (
          <>
            {tags.length > 2 ? (
              <div className="chips" role="group" aria-label="Filter by topic">
                {tags.map((t) => (
                  <button key={t} aria-pressed={t === active} onClick={() => setTag(t)}>{t}</button>
                ))}
              </div>
            ) : null}
            <Paged
              items={shown}
              rowH={ROW_H}
              empty={<p className="stale">{active === "All" ? "No AI stories cleared the bar in the last three days." : `Nothing tagged ${active} right now.`}</p>}
              render={(n) => (
                <Row
                  key={n.id}
                  item={{ id: n.id, kind: "news", title: n.title, url: n.url }}
                  href={n.url}
                  fresh={n.t > since}
                  onDismiss={() => setDismissed((l) => [...l.filter((d) => d.id !== n.id), { id: n.id, title: n.title }].slice(-200))}
                  meta={
                    <>
                      <span className="tag">{n.tag}</span>
                      <span className="opt">{host(n.url)}</span>
                      {n.points ? <span className="num opt">{n.points} pts</span> : null}
                      {n.score !== undefined ? <span className="num" title={n.why}>fit {Math.round(n.score * 100)}</span> : null}
                      <span>{ago(n.t)}</span>
                    </>
                  }
                />
              )}
            />
          </>
        )}
      </Async>
    </Card>
  );
}
