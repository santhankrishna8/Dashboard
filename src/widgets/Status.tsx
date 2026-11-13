import { z } from "zod";
import { Card, Async, RefreshBtn } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { getJson, useFeed } from "../lib/feed";

const SERVICES = [
  { name: "GitHub", page: "https://www.githubstatus.com" },
  { name: "npm", page: "https://status.npmjs.org" },
  { name: "Vercel", page: "https://www.vercel-status.com" },
  { name: "Cloudflare", page: "https://www.cloudflarestatus.com" },
  { name: "Claude", page: "https://status.claude.com" },
  { name: "OpenAI", page: "https://status.openai.com" },
] as const;

const Shape = z.object({ status: z.object({ indicator: z.string().optional(), description: z.string() }) });

/** statuspage.io calls it none, minor, major, critical or maintenance. */
const level = (indicator: string | undefined, description: string): "ok" | "minor" | "major" =>
  indicator === "none" || (!indicator && /operational/i.test(description)) ? "ok" : indicator === "minor" || indicator === "maintenance" ? "minor" : "major";

/** Is it you or them? Live status of the services a developer leans on, straight from their own status pages. */
export function StatusWidget() {
  const feed = useFeed(
    "status",
    async () => {
      const all = await Promise.allSettled(SERVICES.map((s) => getJson(`${s.page}/api/v2/status.json`).then((j) => Shape.parse(j))));
      const rows = all.map((r, i) => {
        const s = SERVICES[i] as (typeof SERVICES)[number];
        return r.status === "fulfilled"
          ? { name: s.name, page: s.page, level: level(r.value.status.indicator, r.value.status.description), text: r.value.status.description }
          : { name: s.name, page: s.page, level: "unknown" as const, text: "Couldn't check" };
      });
      if (rows.every((r) => r.level === "unknown")) throw new Error("None of the status pages answered");
      return rows;
    },
    5 * 60_000,
  );
  const issues = feed.data ? feed.data.filter((r) => r.level === "minor" || r.level === "major").length : 0;

  return (
    <Card title="Service status" meta={feed.data ? (issues === 0 ? "all operational" : `${issues} with issues`) : undefined} actions={<RefreshBtn feed={feed} label="service status" />}>
      <Async feed={feed} rows={5}>
        {(rows) => (
          <Paged
            items={rows}
            rowH={36}
            render={(s) => (
              <div className="svc" key={s.name} data-level={s.level}>
                <i className="dot" aria-hidden="true" />
                <a className="plain" href={s.page} target="_blank" rel="noopener noreferrer"><strong>{s.name}</strong></a>
                <span className="svc-text">{s.text}</span>
              </div>
            )}
          />
        )}
      </Async>
    </Card>
  );
}
