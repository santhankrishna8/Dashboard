import { useCallback, useMemo } from "react";
import { useSynced } from "../lib/sync";
import { DESKS, MAX_COLS, isWidgetId, type CardRef, type Col, type WidgetId } from "./registry";

/** layout[desk][column].cards[index] */
export type Layout = Col[][];
export interface Pos {
  d: number;
  c: number;
  i: number;
}
/** Either a slot inside a column, or a brand-new column at gutter `g` (0 = before the first column). */
export type Target = Pos | { d: number; g: number };
export type Source = { from: Pos } | { id: WidgetId };

const KEY = "sd:layout:v4";
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const defaults = (): Layout => DESKS.map((d) => d.cols.map((c) => ({ w: c.w, cards: c.cards.map((k) => ({ ...k })) })));

/** Empty columns disappear; an empty desk keeps one column so there is somewhere to drop. */
const normalize = (l: Layout): Layout =>
  l.map((desk) => {
    const cols = desk.filter((c) => c.cards.length > 0);
    return cols.length > 0 ? cols : [{ w: 3, cards: [] }];
  });

const num = (v: unknown, fallback: number, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : fallback);

function cols(raw: unknown, seen: Set<WidgetId>): Col[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.slice(0, MAX_COLS).map((c: { w?: unknown; cards?: unknown } | null) => ({
    w: num(c?.w, 3, 0.5, 12),
    cards: (Array.isArray(c?.cards) ? c.cards : []).flatMap((k: { id?: unknown; h?: unknown } | null) => {
      const id = k?.id;
      if (!isWidgetId(id) || seen.has(id)) return [];
      seen.add(id);
      return [{ id, h: num(k?.h, 4, 0.5, 24) }];
    }),
  }));
}

/** Stored layouts are keyed by desk id, so adding a desk never disturbs the others. The old two-desk format is migrated. */
function parse(stored: unknown): Layout {
  let byId: Record<string, unknown> = {};
  if (stored && typeof stored === "object" && !Array.isArray(stored)) byId = stored as Record<string, unknown>;
  else {
    try {
      const v3: unknown = JSON.parse(localStorage.getItem("sd:layout:v3") ?? "null");
      if (Array.isArray(v3)) byId = { build: v3[0], world: v3[1] };
    } catch {
      /* no old layout */
    }
  }
  const seen = new Set<WidgetId>();
  const base = defaults();
  return normalize(DESKS.map((d, i) => cols(byId[d.id], seen) ?? (base[i] as Col[]).filter((c) => (c.cards = c.cards.filter((k) => !seen.has(k.id))).length > 0).map((c) => (c.cards.forEach((k) => seen.add(k.id)), c))));
}

const serialize = (l: Layout) => Object.fromEntries(DESKS.map((d, i) => [d.id, l[i]]));

const copy = (l: Layout): Layout => l.map((d) => d.map((c) => ({ w: c.w, cards: [...c.cards] })));

function place(l: Layout, src: Source, tgt: Target): Layout {
  const next = copy(l);
  let original: CardRef | undefined;
  let card: CardRef;
  if ("from" in src) {
    original = next[src.from.d]?.[src.from.c]?.cards[src.from.i];
    if (!original) return l;
    card = { ...original };
  } else {
    if (l.some((d) => d.some((c) => c.cards.some((k) => k.id === src.id)))) return l;
    card = { id: src.id, h: 4 };
  }
  const desk = next[tgt.d];
  if (!desk) return l;
  if ("g" in tgt && desk.length < MAX_COLS) {
    desk.splice(clamp(tgt.g, 0, desk.length), 0, { w: 3, cards: [card] });
  } else {
    const column = desk["g" in tgt ? clamp(tgt.g, 0, desk.length - 1) : tgt.c];
    if (!column) return l;
    column.cards.splice("g" in tgt ? column.cards.length : clamp(tgt.i, 0, column.cards.length), 0, card);
  }
  // The copy went in first, so removing the original by identity needs no index arithmetic.
  if (original) for (const d of next) for (const c of d) c.cards = c.cards.filter((k) => k !== original);
  return normalize(next);
}

export function useLayout() {
  const [stored, setStored] = useSynced<unknown>(KEY, null);
  const layout = useMemo(() => parse(stored), [stored]);
  const setLayout = useCallback((fn: (l: Layout) => Layout) => setStored((prev: unknown) => serialize(fn(parse(prev)))), [setStored]);

  const placed = useMemo(() => new Set(layout.flatMap((d) => d.flatMap((c) => c.cards.map((k) => k.id)))), [layout]);

  return {
    layout,
    placed,
    place: useCallback((src: Source, tgt: Target) => setLayout((l) => place(l, src, tgt)), []),
    remove: useCallback(
      (p: Pos) =>
        setLayout((l) => {
          const next = copy(l);
          next[p.d]?.[p.c]?.cards.splice(p.i, 1);
          return normalize(next);
        }),
      [],
    ),
    /** Set the width shares of column `c` and the one to its right. */
    setColW: useCallback(
      (d: number, c: number, a: number, b: number) =>
        setLayout((l) => l.map((desk, di) => (di !== d ? desk : desk.map((col, ci) => (ci === c ? { ...col, w: a } : ci === c + 1 ? { ...col, w: b } : col))))),
      [],
    ),
    /** Set the height shares of card `i` and the one below it. */
    setCardH: useCallback(
      (p: Pos, a: number, b: number) =>
        setLayout((l) =>
          l.map((desk, di) =>
            di !== p.d
              ? desk
              : desk.map((col, ci) => (ci !== p.c ? col : { ...col, cards: col.cards.map((k, ki) => (ki === p.i ? { ...k, h: a } : ki === p.i + 1 ? { ...k, h: b } : k)) })),
          ),
        ),
      [],
    ),
    reset: useCallback(() => setLayout(() => defaults()), [setLayout]),
  };
}
