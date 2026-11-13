import { z } from "zod";
import { Card, Async, Empty, RefreshBtn } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { callApi } from "../lib/api";
import { useFeed } from "../lib/feed";
import { ago } from "../lib/fmt";
import { useSaved } from "../lib/store";

const Project = z.object({
  id: z.string(),
  name: z.string(),
  framework: z.string().nullable(),
  state: z.string(),
  site: z.string().nullable(),
  at: z.number().nullable(),
  up: z.boolean().nullable(),
  protectedSite: z.boolean(),
});
const Data = z.object({ total: z.number(), live: z.number(), projects: z.array(Project) });
type Loaded = { configured: false } | ({ configured: true } & z.infer<typeof Data>);
type P = z.infer<typeof Project>;

/** Live means the production deployment is READY and the site answers; the rest are named for what they are. */
const describe = (p: P): { level: "ok" | "minor" | "major" | "unknown"; text: string } => {
  if (p.state === "READY") return p.up === false ? { level: "major", text: "Not responding" } : { level: "ok", text: p.protectedSite ? "Live (protected)" : "Live" };
  if (p.state === "ERROR") return { level: "major", text: "Build failed" };
  if (["BUILDING", "INITIALIZING", "QUEUED"].includes(p.state)) return { level: "minor", text: p.state === "QUEUED" ? "Queued" : "Building" };
  if (p.state === "CANCELED") return { level: "unknown", text: "Canceled" };
  return { level: "unknown", text: "Never deployed" };
};

/** How many projects you have on Vercel and which are live. Needs VERCEL_TOKEN on the server. */
export function VercelWidget() {
  const { token } = useSaved();
  const feed = useFeed<Loaded>(
    "vercel",
    async () => {
      const res = await callApi("/api/vercel", token);
      if (!res) return { configured: false };
      const parsed = Data.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new Error("Vercel returned something unexpected");
      return { configured: true, ...parsed.data };
    },
    3 * 60_000,
  );
  const d = feed.data?.configured ? feed.data : null;
  const bad = d ? d.projects.filter((p) => ["major"].includes(describe(p).level)).length : 0;

  return (
    <Card
      title="Vercel projects"
      meta={d ? `${d.total} project${d.total === 1 ? "" : "s"} · ${d.live} live${bad > 0 ? ` · ${bad} failing` : ""}` : undefined}
      actions={<RefreshBtn feed={feed} label="Vercel" />}
    >
      <Async feed={feed} rows={4}>
        {(data) =>
          !data.configured ? (
            <Empty title="Connect Vercel" hint="Create a token at vercel.com/account/tokens, add it to .env as VERCEL_TOKEN (and VERCEL_TEAM_ID if your projects are in a team), then restart." />
          ) : (
            <Paged
              items={[...data.projects].sort((a, b) => (b.at ?? 0) - (a.at ?? 0))}
              rowH={36}
              empty={<p className="stale">No Vercel projects found for this token.</p>}
              render={(p) => {
                const s = describe(p);
                return (
                  <div className="svc vp" key={p.id} data-level={s.level} title={p.framework ? `${p.name} (${p.framework})` : p.name}>
                    <i className="dot" aria-hidden="true" />
                    {p.site ? (
                      <a className="plain" href={p.site} target="_blank" rel="noopener noreferrer"><strong>{p.name}</strong></a>
                    ) : (
                      <strong>{p.name}</strong>
                    )}
                    <span className="svc-text">{s.text}{p.at ? ` · ${ago(p.at)}` : ""}</span>
                  </div>
                );
              }}
            />
          )
        }
      </Async>
    </Card>
  );
}
