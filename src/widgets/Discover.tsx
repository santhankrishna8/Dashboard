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
