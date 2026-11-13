import { z } from "zod";
import { Card, Async, RefreshBtn } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { Row, ROW_H } from "../ui/Row";
import { getJson, useFeed } from "../lib/feed";
import { ago, compact } from "../lib/fmt";
import { useSince } from "../lib/seen";

const HOUR = 3_600_000;

/* ---------- GitHub: new repos that are gaining stars fast ---------- */
const Repos = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      full_name: z.string(),
      html_url: z.string(),
      description: z.string().nullish(),
      stargazers_count: z.number(),
      language: z.string().nullish(),
      created_at: z.string(),
    }),
  ),
});

export function ReposWidget() {
  const since = useSince("repos");
  const feed = useFeed(
    "repos",
    async () => {
      const since = new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10);
      const q = encodeURIComponent(`created:>${since} stars:>80 (llm OR agent OR "ai" OR mcp OR rag)`);
      const j = await getJson(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=30`);
      return Repos.parse(j).items;
    },
    6 * HOUR,
  );
  return (
    <Card title="Repos worth a look" meta="new in the last 3 weeks" actions={<RefreshBtn feed={feed} label="repos" />}>
      <Async feed={feed} rows={5}>
        {(items) => (
          <Paged
            items={items}
            rowH={ROW_H}
            render={(r) => (
              <Row
                key={r.id}
                item={{ id: `repo-${r.id}`, kind: "repo", title: r.full_name, url: r.html_url, note: r.description ?? undefined }}
                href={r.html_url}
                desc={r.description}
                fresh={Date.parse(r.created_at) > since}
                meta={
                  <>
                    <span className="num">★ {compact(r.stargazers_count)}</span>
                    {r.language ? <span className="opt">{r.language}</span> : null}
                    <span className="opt">{ago(Date.parse(r.created_at))}</span>
                  </>
                }
              />
            )}
          />
        )}
      </Async>
    </Card>
  );
}

/* ---------- Hugging Face: trending models ---------- */
const Models = z.array(
  z.object({
    id: z.string(),
    likes: z.number().optional(),
    downloads: z.number().optional(),
    pipeline_tag: z.string().nullish(),
  }),
);

export function ModelsWidget() {
  const feed = useFeed(
    "models",
    async () => Models.parse(await getJson("https://huggingface.co/api/models?sort=trendingScore&limit=30")),
    3 * HOUR,
  );
  return (
    <Card title="Trending models" meta="Hugging Face" actions={<RefreshBtn feed={feed} label="models" />}>
      <Async feed={feed} rows={5}>
        {(items) => (
          <Paged
            items={items}
            rowH={ROW_H}
            render={(m) => (
              <Row
                key={m.id}
                item={{ id: `model-${m.id}`, kind: "model", title: m.id, url: `https://huggingface.co/${m.id}` }}
                href={`https://huggingface.co/${m.id}`}
                meta={
                  <>
                    {m.pipeline_tag ? <span className="tag opt">{m.pipeline_tag}</span> : null}
                    <span className="num">♥ {compact(m.likes ?? 0)}</span>
                    <span className="num opt">↓ {compact(m.downloads ?? 0)}</span>
                  </>
                }
              />
            )}
          />
        )}
      </Async>
    </Card>
  );
}

/* ---------- Hugging Face: daily papers ---------- */
const Papers = z.array(
  z.object({
    title: z.string().optional(),
    paper: z.object({ id: z.string(), title: z.string(), upvotes: z.number().optional(), publishedAt: z.string().optional() }),
  }),
);

export function PapersWidget() {
  const feed = useFeed(
    "papers",
    async () => Papers.parse(await getJson("https://huggingface.co/api/daily_papers?limit=30")),
    6 * HOUR,
  );
  return (
    <Card title="Papers of the day" meta="Hugging Face" actions={<RefreshBtn feed={feed} label="papers" />}>
      <Async feed={feed} rows={5}>
        {(items) => (
          <Paged
            items={[...items].sort((a, b) => (b.paper.upvotes ?? 0) - (a.paper.upvotes ?? 0))}
            rowH={ROW_H}
            render={({ paper }) => (
              <Row
                key={paper.id}
                item={{ id: `paper-${paper.id}`, kind: "paper", title: paper.title, url: `https://huggingface.co/papers/${paper.id}` }}
                href={`https://huggingface.co/papers/${paper.id}`}
                meta={
                  <>
                    <span className="num">▲ {paper.upvotes ?? 0}</span>
                    <span className="opt">arXiv {paper.id}</span>
                  </>
                }
              />
            )}
          />
        )}
      </Async>
    </Card>
  );
}

/* ---------- Hacker News front page ---------- */
const Front = z.object({
  hits: z.array(
    z.object({
      objectID: z.string(),
      title: z.string().nullish(),
      url: z.string().nullish(),
      points: z.number().nullish(),
      num_comments: z.number().nullish(),
      created_at_i: z.number(),
    }),
  ),
});

export function HNWidget() {
  const since = useSince("hn");
  const feed = useFeed(
    "hn-front",
    async () => Front.parse(await getJson("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30")).hits,
    30 * 60_000,
  );
  return (
    <Card title="Hacker News" meta="front page" actions={<RefreshBtn feed={feed} label="Hacker News" />}>
      <Async feed={feed} rows={5}>
        {(hits) => (
          <Paged
            items={hits.filter((h) => h.title)}
            rowH={ROW_H}
            render={(h) => {
              const url = h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`;
              return (
                <Row
                  key={h.objectID}
                  item={{ id: `hn-${h.objectID}`, kind: "news", title: h.title ?? "", url }}
                  href={url}
                  fresh={h.created_at_i * 1000 > since}
                  meta={
                    <>
                      <span className="num">{h.points ?? 0} pts</span>
                      <a className="opt" href={`https://news.ycombinator.com/item?id=${h.objectID}`} target="_blank" rel="noopener noreferrer">{h.num_comments ?? 0} comments</a>
                      <span>{ago(h.created_at_i * 1000)}</span>
                    </>
                  }
                />
              );
            }}
          />
        )}
      </Async>
    </Card>
  );
}
