import { useState } from "react";
import { z } from "zod";
import { Card, Async, Empty, RefreshBtn } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { Row, ROW_H } from "../ui/Row";
import { callApi } from "../lib/api";
import { useFeed } from "../lib/feed";
import { ago } from "../lib/fmt";
import { useSaved } from "../lib/store";

const Pr = z.object({ id: z.number(), title: z.string(), repo: z.string(), url: z.string(), updated: z.string(), draft: z.boolean().optional() });
const Data = z.object({ login: z.string(), mine: z.array(Pr), review: z.array(Pr) });
type Loaded = { configured: false } | ({ configured: true } & z.infer<typeof Data>);

/** Your open pull requests and the ones waiting on your review. Needs GITHUB_TOKEN on the server; the token never reaches the browser. */
export function GithubWidget() {
  const { token } = useSaved();
  const [tab, setTab] = useState<"mine" | "review">("review");
  const feed = useFeed<Loaded>(
    "github",
    async () => {
      const res = await callApi("/api/github", token);
      if (!res) return { configured: false };
      const parsed = Data.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new Error("GitHub returned something unexpected");
      return { configured: true, ...parsed.data };
    },
    10 * 60_000,
  );

  return (
    <Card title="Your GitHub" meta={feed.data?.configured ? `@${feed.data.login}` : undefined} actions={<RefreshBtn feed={feed} label="GitHub" />}>
      <Async feed={feed} rows={4}>
        {(d) =>
          !d.configured ? (
            <Empty title="Connect GitHub" hint="Add GITHUB_TOKEN to .env (a token that can read your pull requests), restart, and your open PRs and review requests show up here." />
          ) : (
            <>
              <div className="seg" role="group" aria-label="Pull request list">
                <button aria-pressed={tab === "review"} onClick={() => setTab("review")}>Review requests {d.review.length}</button>
                <button aria-pressed={tab === "mine"} onClick={() => setTab("mine")}>My PRs {d.mine.length}</button>
              </div>
              <Paged
                items={tab === "review" ? d.review : d.mine}
                rowH={ROW_H}
                empty={<p className="stale">{tab === "review" ? "Nobody is waiting on your review." : "You have no open pull requests."}</p>}
                render={(p) => (
                  <Row
                    key={p.id}
                    item={{ id: `pr-${p.id}`, kind: "repo", title: p.title, url: p.url, note: p.repo }}
                    href={p.url}
                    desc={p.repo}
                    meta={<>{p.draft ? <span className="tag">Draft</span> : null}<span>{ago(Date.parse(p.updated))}</span></>}
                  />
                )}
              />
            </>
          )
        }
      </Async>
    </Card>
  );
}
