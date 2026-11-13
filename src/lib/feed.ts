import { useEffect, useRef, useSyncExternalStore } from "react";

interface Entry {
  data: unknown;
  updatedAt: number | null;
  error: string | null;
  loading: boolean;
}

/* One shared entry per key, so every card and the top-bar strip that read the same feed stay in step and fetch once. */
const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const inflight = new Set<string>();

const readCache = (key: string): { t: number; data: unknown } | null => {
  try {
    const raw = localStorage.getItem(`sd:${key}`);
    return raw ? (JSON.parse(raw) as { t: number; data: unknown }) : null;
  } catch {
    return null;
  }
};

function get(key: string): Entry {
  let e = entries.get(key);
  if (!e) {
    const c = readCache(key);
    e = { data: c ? c.data : null, updatedAt: c ? c.t : null, error: null, loading: !c };
    entries.set(key, e);
  }
  return e;
}

function set(key: string, patch: Partial<Entry>) {
  entries.set(key, { ...get(key), ...patch });
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string, fn: () => void) {
  let s = listeners.get(key);
  if (!s) listeners.set(key, (s = new Set()));
  s.add(fn);
  return () => {
    s.delete(fn);
  };
}

async function run(key: string, load: () => Promise<unknown>) {
  if (inflight.has(key)) return;
  inflight.add(key);
  set(key, { loading: get(key).data === null, error: null });
  try {
    const data = await load();
    const t = Date.now();
    try {
      localStorage.setItem(`sd:${key}`, JSON.stringify({ t, data }));
    } catch {
      /* storage full or blocked: the feed still works, just uncached */
    }
    set(key, { data, updatedAt: t, error: null, loading: false });
  } catch (e) {
    set(key, { error: e instanceof Error ? e.message : "Request failed", loading: false });
  } finally {
    inflight.delete(key);
  }
}

export interface Feed<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  refresh: () => void;
}

/**
 * Stale-while-revalidate feed. Cached data renders immediately; a fetch only
 * fires when the cache is older than `ttl`, and again every `ttl` after that.
 * This is what keeps AI news at one refresh per two hours.
 */
export function useFeed<T>(key: string, load: () => Promise<T>, ttl: number): Feed<T> {
  const entry = useSyncExternalStore(
    (fn) => subscribe(key, fn),
    () => get(key),
  );
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const check = () => {
      const e = get(key);
      if (e.updatedAt === null || Date.now() - e.updatedAt > ttl) void run(key, () => loadRef.current());
    };
    check();
    const id = window.setInterval(check, Math.min(ttl, 60_000));
    return () => window.clearInterval(id);
  }, [key, ttl]);

  return {
    data: entry.data as T | null,
    loading: entry.loading,
    error: entry.error,
    updatedAt: entry.updatedAt,
    refresh: () => void run(key, () => loadRef.current()),
  };
}

/** Read whatever a feed last loaded, without ever triggering a request. The caller validates the shape. */
export function usePeek(key: string): unknown {
  return useSyncExternalStore(
    (fn) => subscribe(key, fn),
    () => get(key),
  ).data;
}

/** Read a feed's last data right now, without subscribing or fetching. The caller validates the shape. */
export const peekNow = (key: string): unknown => get(key).data;

export async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${new URL(url, location.href).hostname} answered ${res.status}`);
  return res.json();
}
