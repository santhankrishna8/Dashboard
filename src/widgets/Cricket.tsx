import { useState } from "react";
import { z } from "zod";
import { Card, Async, RefreshBtn } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { getJson, useFeed } from "../lib/feed";

const Side = z.object({
  score: z.string().optional(),
  winner: z.union([z.boolean(), z.string()]).optional(),
  team: z.object({ displayName: z.string(), abbreviation: z.string().optional(), countryCode: z.string().optional() }),
});
const Ev = z.object({
  id: z.string(),
  date: z.string(),
  status: z.object({ summary: z.string().optional(), type: z.object({ state: z.enum(["pre", "in", "post"]), description: z.string().optional() }) }),
  competitions: z.array(z.object({ competitors: z.array(Side) })).min(1),
  links: z.array(z.object({ href: z.string() })).optional(),
});
const Panel = z.object({ scores: z.array(z.object({ leagues: z.array(z.object({ name: z.string() })).min(1), events: z.array(z.unknown()).optional() })) });

const INDIA = /india|ipl|ranji|mushtaq|hazare|duleep|irani/i;
const FILTERS = ["All", "Live", "India"] as const;
type Filter = (typeof FILTERS)[number];
const ORDER = { in: 0, pre: 1, post: 2 } as const;
const DAY = 24 * 3600_000;

/** "Today 3:30 pm", "Tomorrow 5:45 pm", or "Mon 8:00 pm", in the viewer's own timezone. */
function kickoff(t: number): string {
  const d = new Date(t);
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(d) - midnight(new Date())) / DAY);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const day = days === 0 ? "Today" : days === 1 ? "Tomorrow" : days === -1 ? "Yesterday" : d.toLocaleDateString([], { weekday: "short" });
  return `${day} ${time}`;
}

async function load() {
  const panel = Panel.parse(await getJson("https://site.api.espn.com/apis/site/v2/sports/cricket/scorepanel"));
  const now = Date.now();
  const seen = new Set<string>();
  const out = panel.scores.flatMap((s) =>
    (s.events ?? []).flatMap((raw) => {
      const e = Ev.safeParse(raw);
      const league = s.leagues[0]?.name ?? "";
      const sides = e.success ? e.data.competitions[0]?.competitors : undefined;
      if (!e.success || !sides || sides.length < 2 || seen.has(e.data.id)) return [];
      seen.add(e.data.id);
      const t = Date.parse(e.data.date);
      const summary = e.data.status.summary ?? "";
      // ESPN flags some fixtures "in play" before the toss; the summary ("Starts at 11:00 local time") gives them away.
      const state = e.data.status.type.state === "in" && /^starts at/i.test(summary) ? "pre" : e.data.status.type.state;
      const desc = e.data.status.type.description;
      // The panel carries a few days of history; anything older than three days is old news, and far-future fixtures can wait.
      if (Number.isNaN(t) || (state === "post" && now - t > 3 * DAY) || (state === "pre" && t - now > 2 * DAY)) return [];
      return [
        {
          id: e.data.id,
          league,
          state,
          // "Live" unless play is paused (Stumps, Lunch, Rain delay...), which ESPN reports as the status description.
          pause: state === "in" && desc && !/^live$/i.test(desc) ? desc : null,
          t,
          india: INDIA.test(league) || sides.some((x) => x.team.countryCode === "IN"),
          url: e.data.links?.[0]?.href,
          summary,
          sides: sides.slice(0, 2).map((x) => ({
            name: x.team.displayName,
            short: x.team.abbreviation ?? x.team.displayName,
            score: (x.score ?? "").split(" (")[0] ?? "",
            overs: /\(([\d.]+)(?:\/\d+)? ov/.exec(x.score ?? "")?.[1],
            won: x.winner === true || x.winner === "true",
          })),
        },
      ];
    }),
  );
  if (out.length === 0) throw new Error("No cricket matches in the feed right now");
  return out.sort((a, b) => ORDER[a.state] - ORDER[b.state] || Number(b.india) - Number(a.india) || (a.state === "post" ? b.t - a.t : a.t - b.t));
}

/** Live scores, results and what's next, with Indian cricket first. Data is ESPNcricinfo's public scoreboard; live games refresh every two minutes. */
export function CricketWidget() {
  const [filter, setFilter] = useState<Filter>("All");
  const feed = useFeed("cricket", load, 2 * 60_000);
  const live = feed.data ? feed.data.filter((m) => m.state === "in" && !m.pause).length : 0;
  return (
    <Card title="Cricket" meta={live > 0 ? `${live} live now` : "scores and fixtures"} actions={<RefreshBtn feed={feed} label="cricket scores" />}>
      <Async feed={feed} rows={5}>
        {(rows) => {
          const shown = filter === "Live" ? rows.filter((m) => m.state === "in") : filter === "India" ? rows.filter((m) => m.india) : rows;
          return (
            <>
              <div className="chips" role="group" aria-label="Filter matches">
                {FILTERS.map((f) => (
                  <button key={f} aria-pressed={f === filter} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
              <Paged
                items={shown}
                rowH={58}
                empty={<p className="stale">{filter === "Live" ? "Nothing is being played right now." : "No Indian matches in the last few days."}</p>}
                render={(m) => (
                  <div className="cr" key={m.id} data-state={m.state}>
                    <div className="cr-teams">
                      {m.sides.map((s) => (
                        <span className={`cr-t${s.won ? " won" : ""}`} key={s.short} title={s.name}>
                          <span className="cr-n">{s.name}</span>
                          <span className="num cr-s">
                            {s.score || (m.state === "pre" ? "" : "–")}
                            {s.overs && m.state === "in" ? <small> {s.overs} ov</small> : null}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div className="cr-info">
                      <span className={`cr-st${m.state === "in" && !m.pause ? " live" : ""}`}>
                        {m.state === "in" && !m.pause ? <i aria-hidden="true" /> : null}
                        {m.state === "pre" ? kickoff(m.t) : m.state === "in" ? (m.pause ?? "Live") : "Final"}
                      </span>
                      <span className="muted cr-sum">{m.state === "pre" ? m.league : m.summary || m.league}</span>
                    </div>
                    {m.url ? <a className="cr-link" href={m.url} target="_blank" rel="noopener noreferrer" aria-label={`${m.sides[0]?.name} v ${m.sides[1]?.name} on ESPNcricinfo`} /> : null}
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
