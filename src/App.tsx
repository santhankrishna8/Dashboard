import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from "react";
import { ChevronLeft, ChevronRight, Cloud, CloudOff, Command as CmdIcon, GripVertical, LayoutGrid, Lock, LogOut, Moon, Sun, Unlock as UnlockIcon, X } from "lucide-react";
import { z } from "zod";
import { DESKS, MAX_COLS, WIDGETS, isWidgetId, type WidgetId } from "./app/registry";
import { useLayout, type Pos, type Target } from "./app/layout";
import { Dock } from "./app/Dock";
import { Ticker } from "./app/Ticker";
import { Palette, type Command } from "./app/Palette";
import { Unlock } from "./app/Unlock";
import { useSaved, hasFirebase } from "./lib/store";
import { getSynced, useSynced } from "./lib/sync";
import { peekNow } from "./lib/feed";
import { toast } from "./lib/toast";
import { Toasts } from "./ui/Toasts";

type Theme = "dark" | "light";
type Drag = { kind: "move"; pos: Pos } | { kind: "add"; id: WidgetId };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const deskFromHash = () => Math.max(0, DESKS.findIndex((d) => d.id === location.hash.slice(1)));
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Cards never re-render because a neighbour is being dragged or resized. */
const Slot = memo(function Slot({ id }: { id: WidgetId }) {
  const { Comp } = WIDGETS[id];
  return <Comp />;
});

function useMedia(q: string) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

const initialTheme = (): Theme => {
  try {
    const t = localStorage.getItem("sd:theme");
    if (t === "light" || t === "dark") return t;
  } catch {
    /* ignore */
  }
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

/**
 * Drag a gap to move space between the two things on either side of it.
 * `apply` receives the first one's new share (0..1) of their combined size.
 */
function dragShare(e: RPointerEvent<HTMLElement>, axis: "x" | "y", min: number, apply: (share: number) => void) {
  const gap = e.currentTarget;
  const a = gap.previousElementSibling;
  const b = gap.nextElementSibling;
  if (!(a instanceof HTMLElement) || !(b instanceof HTMLElement)) return;
  const size = (el: HTMLElement) => (axis === "x" ? el.getBoundingClientRect().width : el.getBoundingClientRect().height);
  const first = size(a);
  const total = first + size(b);
  if (total < min * 2) return;
  e.preventDefault();
  const start = axis === "x" ? e.clientX : e.clientY;
  try {
    gap.setPointerCapture(e.pointerId);
  } catch {
    /* pointer already released; the move listeners below still work */
  }
  const move = (ev: PointerEvent) => apply(clamp(first + (axis === "x" ? ev.clientX : ev.clientY) - start, min, total - min) / total);
  const stop = () => {
    gap.removeEventListener("pointermove", move);
    gap.removeEventListener("pointerup", stop);
    gap.removeEventListener("pointercancel", stop);
  };
  gap.addEventListener("pointermove", move);
  gap.addEventListener("pointerup", stop);
  gap.addEventListener("pointercancel", stop);
}

export default function App() {
  const { items, user, signIn, signOut, hasPass, unlock, lock } = useSaved();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const L = useLayout();
  const [active, setActive] = useState(deskFromHash);
  const [card, setCard] = useState(0);
  const [editing, setEditing] = useState(false);
  const [palette, setPalette] = useState(false);
  const [theme, setTheme] = useSynced<Theme>("sd:theme", initialTheme());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const narrow = useMedia("(max-width: 899px)");
  const canDrag = editing && !narrow;
  const scroller = useRef<HTMLDivElement>(null);
  const refocus = useRef<WidgetId | null>(null);

  /** Phone order: every card of desk 1, then every card of desk 2, one per screen. */
  const flat = useMemo(() => L.layout.flatMap((cols, d) => cols.flatMap((c) => c.cards.map((k) => ({ d, id: k.id })))), [L.layout]);
  const live = useRef({ narrow, flat, active });
  live.current = { narrow, flat, active };

  /** The page (a desk on wide screens, a card on phones) the reader is on. Only the reader's own scrolling changes it, never a resize. */
  const page = useRef(deskFromHash());
  /** Resizing makes the browser fire scroll events; ignore them until this time so they can't move `page`. */
  const settling = useRef(0);

  const go = useCallback((d: number, instant = false) => {
    const el = scroller.current;
    if (!el) return;
    const target = live.current.narrow ? Math.max(0, live.current.flat.findIndex((f) => f.d === d)) : d;
    page.current = target;
    el.scrollTo({ left: target * el.clientWidth, behavior: instant || reducedMotion() ? "instant" : "smooth" });
  }, []);

  const endDrag = useCallback(() => {
    setDrag(null);
    setOver(null);
  }, []);
  const flipTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), [setTheme]);

  // Land on the desk named in the URL. After that, any width change re-pins the same page, so the view is never left half-way between two.
  const mounted = useRef(false);
  const wasNarrow = useRef(narrow);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const { flat: cards } = live.current;
    if (!mounted.current) {
      mounted.current = true;
      page.current = narrow ? Math.max(0, cards.findIndex((f) => f.d === deskFromHash())) : deskFromHash();
    } else if (wasNarrow.current !== narrow) {
      // Switching between desks and one-card-per-screen: keep the reader on the same desk.
      const desk = wasNarrow.current ? (cards[page.current]?.d ?? 0) : page.current;
      page.current = narrow ? Math.max(0, cards.findIndex((f) => f.d === desk)) : desk;
    }
    wasNarrow.current = narrow;

    const pin = () => {
      settling.current = performance.now() + 250;
      el.scrollTo({ left: page.current * el.clientWidth, behavior: "instant" });
    };
    pin();
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      pin();
    });
    ro.observe(el);
    const onHash = () => go(deskFromHash());
    window.addEventListener("hashchange", onHash);
    return () => {
      ro.disconnect();
      window.removeEventListener("hashchange", onHash);
    };
  }, [go, narrow]);

  useEffect(() => {
    const id = DESKS[active]?.id;
    if (id && location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
  }, [active]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0F0E0C" : "#F4F1EA");
  }, [theme]);

  // After a keyboard move the card may have been re-created in another column; give it focus back.
  useEffect(() => {
    if (!refocus.current) return;
    document.querySelector<HTMLElement>(`[data-widget="${refocus.current}"] .grip`)?.focus();
    refocus.current = null;
  }, [L.layout]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const typing = t instanceof HTMLElement && (t.matches("input, textarea, select") || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
      if (t instanceof HTMLElement && t.closest("[data-keys]")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= DESKS.length) return go(n - 1);
      const k = e.key.toLowerCase();
      if (k === "arrowright") go(Math.min(DESKS.length - 1, live.current.active + 1));
      else if (k === "arrowleft") go(Math.max(0, live.current.active - 1));
      else if (k === "n") {
        e.preventDefault();
        go(Math.max(0, DESKS.findIndex((d) => d.cols.some((c) => c.cards.some((k2) => k2.id === "pad")))));
        window.setTimeout(() => document.getElementById("pad")?.focus({ preventScroll: true }), 450);
      } else if (k === "e") setEditing((v) => !v);
      else if (k === "t") flipTheme();
      else if (k === "/") {
        e.preventDefault();
        setPalette(true);
      } else if (k === "escape") setEditing(false);
      else if (k === "s") document.querySelector<HTMLButtonElement>(".row:hover .save, .row:focus-within .save, .idea:hover .save, .card:hover > header .save")?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, flipTheme]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || el.clientWidth === 0 || performance.now() < settling.current) return;
    const here = Math.round(el.scrollLeft / el.clientWidth);
    page.current = here;
    if (narrow) {
      setCard(clamp(here, 0, Math.max(0, flat.length - 1)));
      setActive(flat[here]?.d ?? 0);
    } else setActive(clamp(here, 0, DESKS.length - 1));
  };

  const dropAt = (t: Target) => {
    if (!drag) return;
    L.place(drag.kind === "move" ? { from: drag.pos } : { id: drag.id }, t);
    endDrag();
  };
  const accept = (e: DragEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setOver((o) => (o === key ? o : key));
  };

  /** Arrow keys on a focused card in customise mode. */
  const nudge = (pos: Pos, id: WidgetId, key: string) => {
    const cols = L.layout[pos.d];
    const here = cols?.[pos.c];
    if (!cols || !here) return;
    let t: Target | null = null;
    if (key === "ArrowUp" && pos.i > 0) t = { ...pos, i: pos.i - 1 };
    else if (key === "ArrowDown" && pos.i < here.cards.length - 1) t = { ...pos, i: pos.i + 2 };
    else if (key === "ArrowLeft" || key === "ArrowRight") {
      const step = key === "ArrowLeft" ? -1 : 1;
      const c = pos.c + step;
      const next = cols[c];
      if (next) t = { d: pos.d, c, i: Math.min(pos.i, next.cards.length) };
      else {
        const d = pos.d + step;
        const other = L.layout[d];
        if (other) {
          const oc = step < 0 ? other.length - 1 : 0;
          t = { d, c: oc, i: other[oc]?.cards.length ?? 0 };
          go(d);
        }
      }
    }
    if (!t) return;
    refocus.current = id;
    L.place({ from: pos }, t);
  };

  const addToDesk = (id: WidgetId) => {
    const cols = L.layout[active] ?? [];
    let best = 0;
    let least = Infinity;
    cols.forEach((c, i) => {
      const sum = c.cards.reduce((n, k) => n + k.h, 0);
      if (sum < least) {
        least = sum;
        best = i;
      }
    });
    L.place({ id }, { d: active, c: best, i: cols[best]?.cards.length ?? 0 });
  };

  const unplaced = Object.keys(WIDGETS).filter((id): id is WidgetId => isWidgetId(id) && !L.placed.has(id));
  const savedDesk = L.layout.findIndex((d) => d.some((c) => c.cards.some((k) => k.id === "saved")));
  const other = active === 0 ? 1 : 0;

  const search = useCallback(
    (q: string): Command[] => {
      const out: Command[] = [];
      const open = (url: string) => () => void window.open(url, "_blank", "noopener,noreferrer");
      const News = z.object({ items: z.array(z.object({ title: z.string(), url: z.string() })) }).safeParse(peekNow("news"));
      if (News.success) for (const n of News.data.items) if (n.title.toLowerCase().includes(q)) out.push({ id: `n:${n.url}`, label: `Story · ${n.title}`, run: open(n.url) });
      for (const s of items) if (s.url && `${s.title} ${s.note ?? ""}`.toLowerCase().includes(q)) out.push({ id: `s:${s.id}`, label: `Saved · ${s.title}`, run: open(s.url) });
      for (const l of getSynced<{ name: string; url: string }[]>("sd:links", [])) if (l.name.toLowerCase().includes(q)) out.push({ id: `l:${l.url}`, label: `Link · ${l.name}`, run: open(l.url) });
      return out.slice(0, 8);
    },
    [items],
  );

  /** A markdown recap of the week, copied to the clipboard, ready to paste into notes or a message. */
  const copyDigest = useCallback(() => {
    const week = Date.now() - 7 * 86_400_000;
    const mine = items.filter((i) => i.at >= week);
    const News = z.object({ items: z.array(z.object({ title: z.string(), url: z.string() })) }).safeParse(peekNow("news"));
    const text = [
      `# Signal Desk digest, week to ${new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(new Date())}`,
      "",
      `## Saved this week (${mine.length})`,
      ...(mine.length > 0 ? mine.map((i) => `- ${i.url ? `[${i.title}](${i.url})` : i.title}${i.note && i.kind !== "news" ? `: ${i.note.split("\n")[0]}` : ""}`) : ["- Nothing saved."]),
      "",
      "## Top stories right now",
      ...(News.success && News.data.items.length > 0 ? News.data.items.slice(0, 5).map((n) => `- [${n.title}](${n.url})`) : ["- No stories loaded yet."]),
      "",
    ].join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast(`Digest copied: ${mine.length} saved item${mine.length === 1 ? "" : "s"} this week.`),
      () => toast("Couldn't copy. Allow clipboard access for this site and try again."),
    );
  }, [items]);

  const commands = useMemo<Command[]>(
    () => [
      ...DESKS.map((d, i) => ({ id: `go-${d.id}`, label: `Go to the ${d.name} desk`, hint: String(i + 1), run: () => go(i) })),
      { id: "edit", label: editing ? "Finish customising" : "Customise layout", hint: "E", run: () => setEditing((v) => !v) },
      { id: "theme", label: `Switch to ${theme === "dark" ? "light" : "dark"} theme`, hint: "T", run: flipTheme },
      { id: "digest", label: "Copy this week's digest", run: copyDigest },
      { id: "note", label: "Quick note", hint: "N", run: () => void window.setTimeout(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" })), 80) },
      ...(hasFirebase ? [] : [hasPass ? { id: "lock", label: "Lock integrations on this device", run: lock } : { id: "unlock", label: "Unlock integrations (AI, GitHub, Vercel)", run: () => setUnlockOpen(true) }]),
      { id: "reset", label: "Reset layout to the default", run: L.reset },
      ...(hasFirebase ? [user ? { id: "out", label: "Sign out", run: signOut } : { id: "in", label: "Sign in with Google to sync saves", run: signIn }] : []),
    ],
    [editing, theme, user, signIn, signOut, go, flipTheme, L.reset, copyDigest, hasPass, lock],
  );

  return (
    <div className={`app${editing ? " editing" : ""}${drag ? " dragging" : ""}`}>
      <header className="top">
        <a className="brand" href={`#${DESKS[0].id}`} onClick={() => go(0)} aria-label="Signal Desk, first desk">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><rect width="32" height="32" rx="8" className="mark-bg" /><path d="M6 21l6-7 5 4 9-11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Signal Desk</span>
        </a>
        <nav aria-label="Desks">
          {DESKS.map((d, i) => (
            <button key={d.id} id={i === savedDesk ? "nav-saved" : undefined} aria-current={i === active ? "page" : undefined} onClick={() => go(i)}>
              {d.name}
              {i === savedDesk && items.length > 0 ? <span className="count" title={`${items.length} saved`}>{items.length}</span> : <kbd aria-hidden="true">{i + 1}</kbd>}
            </button>
          ))}
        </nav>
        <Ticker />
        <div className="tools">
          <button className="btn" aria-pressed={editing} onClick={() => setEditing((v) => !v)} title="Customise layout (E)">
            <LayoutGrid size={15} /> <span className="hide-sm">Customise</span>
          </button>
          <button className="icon" onClick={() => setPalette(true)} aria-label="Open command palette" title="Command palette (Ctrl K)"><CmdIcon size={16} /></button>
          <button className="icon" onClick={flipTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Theme (T)">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {hasFirebase ? (
            user ? (
              <button className="btn" onClick={signOut} title="Sign out"><Cloud size={15} /> <span className="hide-sm">{user.displayName?.split(" ")[0] ?? "Synced"}</span> <LogOut size={14} /></button>
            ) : (
              <button className="btn primary" onClick={signIn}>Sign in to sync</button>
            )
          ) : hasPass ? (
            <button className="btn" onClick={lock} title="Integrations are unlocked on this device. Click to lock."><UnlockIcon size={14} /> <span className="hide-sm">Unlocked</span></button>
          ) : import.meta.env.DEV ? (
            <span className="chip" title="Firebase isn't configured, so saves live in this browser. See .env.example."><CloudOff size={14} /> <span className="hide-sm">Local only</span></span>
          ) : (
            <button className="btn primary" onClick={() => setUnlockOpen(true)} title="Enter your passcode to turn on the AI, GitHub and Vercel cards"><Lock size={14} /> <span className="hide-sm">Unlock</span></button>
          )}
        </div>
      </header>

      <div className="desks" ref={scroller} onScroll={onScroll}>
        {L.layout.map((cols, d) => {
          const full = cols.length >= MAX_COLS;
          const gutter = (g: number) => {
            const left = cols[g - 1];
            const right = cols[g];
            const inner = !!left && !!right && left.cards.length > 0 && right.cards.length > 0;
            const key = `g:${d}:${g}`;
            const total = (left?.w ?? 0) + (right?.w ?? 0);
            const set = (share: number) => L.setColW(d, g - 1, total * share, total * (1 - share));
            return (
              <div
                key={key}
                className={`gx${inner ? "" : " edge"}`}
                data-over={over === key || undefined}
                {...(canDrag && inner && left
                  ? {
                      role: "separator",
                      tabIndex: 0,
                      "aria-orientation": "vertical" as const,
                      "aria-label": `Resize columns ${g} and ${g + 1}. Use left and right arrows.`,
                      "data-keys": true,
                      onPointerDown: (e: RPointerEvent<HTMLElement>) => dragShare(e, "x", 170, set),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                        e.preventDefault();
                        set(clamp(left.w / total + (e.key === "ArrowLeft" ? -0.03 : 0.03), 0.15, 0.85));
                      },
                    }
                  : {})}
                onDragOver={(e) => {
                  if (drag && !full) accept(e, key);
                }}
                onDrop={(e) => {
                  if (!drag || full) return;
                  e.preventDefault();
                  e.stopPropagation();
                  dropAt({ d, g });
                }}
              />
            );
          };
          return (
            <section key={DESKS[d]?.id ?? d} className="desk" data-desk={d} data-active={d === active} aria-label={`${DESKS[d]?.name ?? ""} desk`}>
              {gutter(0)}
              {cols.map((col, c) => (
                <Fragment key={c}>
                  <div className="col" style={{ flexGrow: col.w }}>
                    {col.cards.map((k, i) => {
                      const pos: Pos = { d, c, i };
                      const name = WIDGETS[k.id].name;
                      const prev = col.cards[i - 1];
                      const sum = (prev?.h ?? 0) + k.h;
                      const setH = (share: number) => L.setCardH({ d, c, i: i - 1 }, sum * share, sum * (1 - share));
                      const before = `c:${d}:${c}:${i}:0`;
                      const after = `c:${d}:${c}:${i}:1`;
                      const mine = drag?.kind === "move" && drag.pos.d === d && drag.pos.c === c && drag.pos.i === i;
                      return (
                        <Fragment key={k.id}>
                          {prev ? (
                            <div
                              className="gy"
                              {...(canDrag
                                ? {
                                    role: "separator",
                                    tabIndex: 0,
                                    "aria-orientation": "horizontal" as const,
                                    "aria-label": `Resize ${WIDGETS[prev.id].name} and ${name}. Use up and down arrows.`,
                                    "data-keys": true,
                                    onPointerDown: (e: RPointerEvent<HTMLElement>) => dragShare(e, "y", 90, setH),
                                    onKeyDown: (e: React.KeyboardEvent) => {
                                      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                                      e.preventDefault();
                                      setH(clamp(prev.h / sum + (e.key === "ArrowUp" ? -0.04 : 0.04), 0.15, 0.85));
                                    },
                                  }
                                : {})}
                              onDragOver={(e) => {
                                if (drag) accept(e, before);
                              }}
                              onDrop={(e) => {
                                if (!drag) return;
                                e.preventDefault();
                                e.stopPropagation();
                                dropAt(pos);
                              }}
                            />
                          ) : null}
                          <div
                            className={`cell${mine ? " lifted" : ""}`}
                            data-widget={k.id}
                            data-drop={mine ? undefined : over === before ? "before" : over === after ? "after" : undefined}
                            style={{ flexGrow: k.h }}
                            draggable={canDrag}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", k.id);
                              setDrag({ kind: "move", pos });
                            }}
                            onDragEnd={endDrag}
                            onDragOver={(e) => {
                              if (!drag) return;
                              const r = e.currentTarget.getBoundingClientRect();
                              accept(e, e.clientY > r.top + r.height / 2 ? after : before);
                            }}
                            onDrop={(e) => {
                              if (!drag) return;
                              e.preventDefault();
                              e.stopPropagation();
                              const r = e.currentTarget.getBoundingClientRect();
                              dropAt({ d, c, i: e.clientY > r.top + r.height / 2 ? i + 1 : i });
                            }}
                          >
                            <div className="cell-in" inert={editing}>
                              <Slot id={k.id} />
                            </div>
                            {editing ? (
                              <div
                                className="grip"
                                role="group"
                                tabIndex={0}
                                data-keys
                                aria-label={canDrag ? `${name}. Arrow keys move it, Delete removes it.` : name}
                                onKeyDown={(e) => {
                                  if (e.target !== e.currentTarget) return;
                                  if (e.key === "Delete" || e.key === "Backspace") {
                                    e.preventDefault();
                                    L.remove(pos);
                                  } else if (e.key.startsWith("Arrow")) {
                                    e.preventDefault();
                                    nudge(pos, k.id, e.key);
                                  }
                                }}
                              >
                                <span className="pill">
                                  {canDrag ? <GripVertical size={14} aria-hidden="true" /> : null}
                                  {name}
                                </span>
                                <button className="grip-x" onClick={() => L.remove(pos)} aria-label={`Remove ${name}`} title="Remove">
                                  <X size={15} />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </Fragment>
                      );
                    })}
                    {col.cards.length === 0 ? (
                      <div
                        className="col-empty"
                        data-over={over === `e:${d}` || undefined}
                        onDragOver={(e) => {
                          if (drag) accept(e, `e:${d}`);
                        }}
                        onDrop={(e) => {
                          if (!drag) return;
                          e.preventDefault();
                          e.stopPropagation();
                          dropAt({ d, c, i: 0 });
                        }}
                      >
                        <strong>This desk is empty</strong>
                        <span>{editing ? "Drop a card here, or pick one from the bar prev." : "Press E to customise and add widgets."}</span>
                      </div>
                    ) : null}
                  </div>
                  {gutter(c + 1)}
                </Fragment>
              ))}
            </section>
          );
        })}
      </div>

      {!narrow ? (
        <button
          className="edge-nav"
          data-side={active === 0 ? "right" : "left"}
          onClick={() => go(other)}
          onDragEnter={() => {
            if (drag) go(other);
          }}
          aria-label={`Go to the ${DESKS[other]?.name ?? ""} desk`}
          title={`${DESKS[other]?.name ?? ""} desk (${other + 1})`}
        >
          {active === 0 ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      ) : null}

      {narrow && flat.length > 1 ? (
        <div className="swiper">
          <button className="icon" onClick={() => scroller.current?.scrollBy({ left: -scroller.current.clientWidth })} disabled={card === 0} aria-label="Previous card"><ChevronLeft size={18} /></button>
          <span>{WIDGETS[flat[card]?.id ?? "news"].name} · {card + 1} / {flat.length}</span>
          <button className="icon" onClick={() => scroller.current?.scrollBy({ left: scroller.current.clientWidth })} disabled={card >= flat.length - 1} aria-label="Next card"><ChevronRight size={18} /></button>
        </div>
      ) : null}

      {editing ? (
        <Dock
          unplaced={unplaced}
          canDrag={canDrag}
          add={addToDesk}
          dragStart={(id) => setDrag({ kind: "add", id })}
          dragEnd={endDrag}
          reset={L.reset}
          done={() => setEditing(false)}
        />
      ) : null}

      <Palette open={palette} onClose={() => setPalette(false)} commands={commands} search={search} />
      <Unlock open={unlockOpen} onClose={() => setUnlockOpen(false)} onUnlock={unlock} />
      <Toasts />
    </div>
  );
}
