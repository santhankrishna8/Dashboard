import { useId, type ReactNode } from "react";
import { Activity, Bookmark, CircleDollarSign, Clock, CloudSun, Cpu, FileText, GitBranch, GitPullRequest, Lightbulb, Link2, Newspaper, NotebookPen, Radar, Radio, RefreshCw, Repeat2, Sparkles, Sunrise, Timer, Triangle, Trophy, type LucideIcon } from "lucide-react";
import type { Feed } from "../lib/feed";
import { ago } from "../lib/fmt";

/** One glyph per card so a column reads at a glance; same set and stroke as every other icon here. */
const ICONS: [string, LucideIcon][] = [
  ["Today", Sunrise],
  ["Your GitHub", GitPullRequest],
  ["Vercel", Triangle],
  ["Review", Repeat2],
  ["Scratchpad", NotebookPen],
  ["Token spend", Activity],
  ["AI news", Newspaper],
  ["Hacker News", Newspaper],
  ["Learn", Sparkles],
  ["Try building", Lightbulb],
  ["Repos", GitBranch],
  ["Trending models", Cpu],
  ["Papers", FileText],
  ["Saved", Bookmark],
  ["Focus", Timer],
  ["AI model radar", Radar],
  ["Cricket", Trophy],
  ["Service status", Radio],
  ["Gold", CircleDollarSign],
  ["Currencies", CircleDollarSign],
  ["Weather", CloudSun],
  ["World clocks", Clock],
  ["Favourite links", Link2],
];

export function Card({ title, meta, actions, children }: { title: string; meta?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const id = useId();
  const Icon = ICONS.find(([k]) => title.startsWith(k))?.[1];
  return (
    <section className="card" aria-labelledby={id}>
      <header>
        {Icon ? <Icon className="card-icon" size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
        <h2 id={id}>{title}</h2>
        {meta ? <span className="meta">{meta}</span> : null}
        <span className="actions">{actions}</span>
      </header>
      <div className="body">{children}</div>
    </section>
  );
}

export function RefreshBtn({ feed, label }: { feed: Feed<unknown>; label: string }) {
  return (
    <button className="icon" onClick={feed.refresh} aria-label={`Refresh ${label}`} title={feed.updatedAt ? `Updated ${ago(feed.updatedAt)}` : "Refresh"}>
      <RefreshCw size={15} strokeWidth={1.75} className={feed.loading ? "spin" : ""} />
    </button>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skel" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <i key={i} style={{ width: `${96 - i * 11}%` }} />
      ))}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}

export function Async<T>({ feed, rows, children }: { feed: Feed<T>; rows?: number; children: (data: T) => ReactNode }) {
  if (feed.data === null) {
    if (feed.error)
      return (
        <div className="empty">
          <strong>Couldn't load this</strong>
          <span>{feed.error}. Your other cards are unaffected.</span>
          <button className="btn" onClick={feed.refresh}>Try again</button>
        </div>
      );
    return <Skeleton rows={rows} />;
  }
  return (
    <>
      {children(feed.data)}
      {feed.error ? <p className="stale">Showing the last good data. Refresh failed: {feed.error}.</p> : null}
    </>
  );
}
