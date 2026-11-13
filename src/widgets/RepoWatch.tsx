import { useEffect, useState } from "react";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { Card, Async, RefreshBtn } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { ListEditor } from "../ui/ListEditor";
import { getJson, useFeed } from "../lib/feed";
import { ago, compact } from "../lib/fmt";
import { useSynced } from "../lib/sync";

const Repo = z.object({ full_name: z.string(), html_url: z.string(), stargazers_count: z.number(), pushed_at: z.string() });
const Release = z.object({ tag_name: z.string(), published_at: z.string().nullable(), html_url: z.string() });
const DEFAULT_REPOS = ["facebook/react", "vitejs/vite", "microsoft/TypeScript", "vercel/next.js", "colinhacks/zod", "tailwindlabs/tailwindcss", "denoland/deno", "oven-sh/bun"];

/** Accepts owner/name or a pasted GitHub URL. */
const toSlug = (text: string): string | null => {
  const s = text.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  return /^[\w.-]+\/[\w.-]+$/.test(s) ? s : null;
};

async function watch(slug: string) {
  const repo = Repo.parse(await getJson(`https://api.github.com/repos/${slug}`));
  // Plenty of good repos never cut a release; that's a normal answer, not an error.
  const rel = await getJson(`https://api.github.com/repos/${slug}/releases/latest`).then((j) => Release.parse(j)).catch(() => null);
  return { slug, name: repo.full_name, url: repo.html_url, stars: repo.stargazers_count, pushed: Date.parse(repo.pushed_at), rel };
}

/** Stars and the latest release for repos you follow. Uses GitHub's public API, so it refreshes every 45 minutes. */
export function RepoWatchWidget() {
  const [slugs, setSlugs] = useSynced<string[]>("sd:watch:repos", DEFAULT_REPOS);
  const [editing, setEditing] = useState(false);
  const want = slugs.join(",");
  const feed = useFeed(
    "repowatch",
    async () => {
      if (slugs.length === 0) return [];
      const all = await Promise.allSettled(slugs.map(watch));
      const ok = all.flatMap((r) => (r.status === "fulfilled" ? [{ ...r.value, q: want }] : []));
      if (ok.length === 0) throw new Error("GitHub's public API didn't answer (it allows about 60 requests an hour)");
      return ok;
    },
    45 * 60_000,
  );
  const loadedFor = feed.data?.[0]?.q;
  const { refresh } = feed;
  useEffect(() => {
    if ((feed.data && feed.data.length === 0 && slugs.length > 0) || (loadedFor !== undefined && loadedFor !== want)) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, loadedFor]);

  return (
    <Card
      title="Repo watch"
      meta="stars and latest release"
      actions={
        <>
          <button className="icon" aria-pressed={editing} onClick={() => setEditing((v) => !v)} aria-label={editing ? "Done editing repos" : "Edit repos"} title={editing ? "Done" : "Choose repos"}>
            <Pencil size={15} strokeWidth={1.75} />
          </button>
          <RefreshBtn feed={feed} label="repo watch" />
        </>
      }
    >
      {editing ? (
        <ListEditor
          items={slugs.map((id) => ({ id, label: id }))}
          placeholder="owner/name, e.g. honojs/hono"
          hint="A GitHub repo, or paste its URL."
          onRemove={(id) => setSlugs((l) => l.filter((x) => x !== id))}
          onAdd={async (text) => {
            const slug = toSlug(text);
            if (!slug) return "Use owner/name, for example vitejs/vite.";
            if (slugs.some((s) => s.toLowerCase() === slug.toLowerCase())) return `${slug} is already on the list.`;
            try {
              await watch(slug);
            } catch {
              return `Couldn't find ${slug} on GitHub (or the rate limit was hit; try again in a few minutes).`;
            }
            setSlugs((l) => [...l, slug]);
            return null;
          }}
        />
      ) : (
        <Async feed={feed} rows={5}>
          {(rows) => (
            <Paged
              items={rows}
              rowH={36}
              empty={<p className="stale">Nothing followed. Use the pencil to add a repo.</p>}
              render={(r) => (
                <div className="fx-row watch" key={r.slug} title={r.rel ? `Latest release ${r.rel.tag_name}` : "No published releases"}>
                  <span className="who">
                    <a className="plain" href={r.url} target="_blank" rel="noopener noreferrer"><strong>{r.name.split("/")[1]}</strong></a>
                    <span className="muted">{r.name.split("/")[0]}</span>
                  </span>
                  <span className="num fx-val">★ {compact(r.stars)}</span>
                  <span className="num rel">
                    {r.rel ? (
                      <a className="plain" href={r.rel.html_url} target="_blank" rel="noopener noreferrer">{r.rel.tag_name}</a>
                    ) : (
                      <span className="muted">no releases</span>
                    )}
                  </span>
                  <span className="muted ago">{ago(r.rel?.published_at ? Date.parse(r.rel.published_at) : r.pushed)}</span>
                </div>
              )}
            />
          )}
        </Async>
      )}
    </Card>
  );
}
