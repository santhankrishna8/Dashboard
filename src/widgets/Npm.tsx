import { useEffect, useState } from "react";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { Card, Async, RefreshBtn } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { Spark } from "../ui/Spark";
import { ListEditor } from "../ui/ListEditor";
import { getJson, useFeed } from "../lib/feed";
import { compact, pct } from "../lib/fmt";
import { useSynced } from "../lib/sync";

const Range = z.object({ downloads: z.array(z.object({ downloads: z.number(), day: z.string() })) });
const DEFAULT_PACKAGES = ["react", "vite", "typescript", "next", "zod", "tailwindcss", "express", "eslint"];
const VALID = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const sum = (n: number[]) => n.reduce((a, b) => a + b, 0);

/** Daily downloads for the last month. npm reports the most recent day late, so trailing zero days are dropped. */
async function pulse(name: string) {
  const days = Range.parse(await getJson(`https://api.npmjs.org/downloads/range/last-month/${name}`)).downloads.map((d) => d.downloads);
  let end = days.length;
  while (end > 0 && days[end - 1] === 0) end--;
  const series = days.slice(0, end);
  const week = sum(series.slice(-7));
  const before = sum(series.slice(-14, -7));
  return { name, week, change: before ? ((week - before) / before) * 100 : 0, series };
}

/** The packages you depend on, with weekly downloads and the 4-week trend. Pick your own with the pencil. */
export function NpmWidget() {
  const [names, setNames] = useSynced<string[]>("sd:watch:npm", DEFAULT_PACKAGES);
  const [editing, setEditing] = useState(false);
  const want = names.join(",");
  const feed = useFeed(
    "npm",
    async () => {
      if (names.length === 0) return [];
      const all = await Promise.allSettled(names.map(pulse));
      const ok = all.flatMap((r) => (r.status === "fulfilled" ? [{ ...r.value, q: want }] : []));
      if (ok.length === 0) throw new Error("The npm download API didn't answer");
      return ok;
    },
    60 * 60_000,
  );
  const loadedFor = feed.data?.[0]?.q;
  const { refresh } = feed;
  useEffect(() => {
    if ((feed.data && feed.data.length === 0 && names.length > 0) || (loadedFor !== undefined && loadedFor !== want)) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, loadedFor]);

  const rising = feed.data ? feed.data.filter((p) => p.change >= 0).length : 0;
  return (
    <Card
      title="Package pulse"
      meta={feed.data && feed.data.length > 0 ? `${rising} of ${feed.data.length} rising · npm weekly downloads` : "npm weekly downloads"}
      actions={
        <>
          <button className="icon" aria-pressed={editing} onClick={() => setEditing((v) => !v)} aria-label={editing ? "Done editing packages" : "Edit packages"} title={editing ? "Done" : "Choose packages"}>
            <Pencil size={15} strokeWidth={1.75} />
          </button>
          <RefreshBtn feed={feed} label="package pulse" />
        </>
      }
    >
      {editing ? (
        <ListEditor
          items={names.map((id) => ({ id, label: id }))}
          placeholder="npm package, e.g. hono or @types/node"
          hint="Any public npm package. Weekly downloads compare the last 7 days with the 7 before."
          onRemove={(id) => setNames((l) => l.filter((x) => x !== id))}
          onAdd={async (text) => {
            const name = text.trim().toLowerCase();
            if (!VALID.test(name)) return `“${text}” isn't a valid npm package name.`;
            if (names.includes(name)) return `${name} is already tracked.`;
            try {
              await pulse(name);
            } catch {
              return `No npm package called ${name}.`;
            }
            setNames((l) => [...l, name]);
            return null;
          }}
        />
      ) : (
        <Async feed={feed} rows={5}>
          {(rows) => (
            <Paged
              items={rows}
              rowH={36}
              empty={<p className="stale">Nothing tracked. Use the pencil to add a package.</p>}
              render={(p) => (
                <div className="fx-row" key={p.name} title={`${new Intl.NumberFormat("en").format(p.week)} downloads in the last 7 days`}>
                  <span className="who">
                    <a className="plain" href={`https://www.npmjs.com/package/${p.name}`} target="_blank" rel="noopener noreferrer"><strong>{p.name}</strong></a>
                  </span>
                  <span className="num fx-val">{compact(p.week)}</span>
                  <span className={`num chg ${p.change >= 0 ? "up" : "down"}`}>{pct(p.change)}</span>
                  <span className={p.change >= 0 ? "up" : "down"}><Spark values={p.series} /></span>
                </div>
              )}
            />
          )}
        </Async>
      )}
    </Card>
  );
}
