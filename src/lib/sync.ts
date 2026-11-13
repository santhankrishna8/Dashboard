import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * Settings that follow you between devices once you are signed in. Anything not listed stays on the device
 * it was set on (feed caches, "last seen" markers, the location prompt flag).
 */
export const SYNCED = [
  "sd:layout:v4",
  "sd:links",
  "sd:city",
  "sd:loc",
  "sd:streak",
  "sd:watch:npm",
  "sd:watch:repos",
  "sd:watch:fx",
  "sd:watch:zones",
  "sd:misses",
  "sd:theme",
  "sd:pad",
  "sd:dismissed",
  "sd:cap",
  "sd:spend",
] as const;

type Json = unknown;
const cache = new Map<string, Json>();
const subs = new Set<() => void>();
const pending = new Set<string>();
let push: ((keys: string[]) => void) | null = null;
let timer = 0;

/** Firestore field names can't hold ":", and nested arrays aren't allowed, so values travel as JSON strings. */
const field = (k: string) => k.replace(/[^a-z0-9]/gi, "_");

function read(key: string): Json | undefined {
  if (cache.has(key)) return cache.get(key);
  let v: Json | undefined;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        v = JSON.parse(raw);
      } catch {
        v = raw; // values written before sync existed (a bare "dark" or "Kolkata")
      }
    }
  } catch {
    /* storage blocked: the app still works for this tab */
  }
  cache.set(key, v);
  return v;
}

function write(key: string, value: Json, fromRemote: boolean) {
  if (JSON.stringify(read(key)) === JSON.stringify(value)) return;
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
  subs.forEach((f) => f());
  if (!fromRemote) {
    pending.add(key);
    window.clearTimeout(timer);
    timer = window.setTimeout(flush, 800);
  }
}

function flush() {
  if (!push || pending.size === 0) return;
  const keys = [...pending];
  pending.clear();
  push(keys);
}

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};

export const getSynced = <T,>(key: string, fallback: T): T => (read(key) === undefined ? fallback : (read(key) as T));
export const setSynced = (key: string, value: Json) => write(key, value, false);

export function useSynced<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const fb = useRef(fallback);
  const v = useSyncExternalStore(subscribe, () => read(key));
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const cur = read(key) === undefined ? fb.current : (read(key) as T);
      write(key, typeof next === "function" ? (next as (p: T) => T)(cur) : next, false);
    },
    [key],
  );
  return [v === undefined ? fb.current : (v as T), set];
}

export interface CloudState {
  watch: (cb: (data: Record<string, string> | undefined) => void) => () => void;
  merge: (data: Record<string, string>) => Promise<void>;
}

/** Cloud wins on first load for keys it has; keys only this device has are uploaded. Later changes flow both ways. */
export function bindCloud(api: CloudState): () => void {
  push = (keys) => void api.merge(Object.fromEntries(keys.map((k) => [field(k), JSON.stringify(read(k) ?? null)])));
  let first = true;
  const off = api.watch((data) => {
    const remote = data ?? {};
    for (const k of SYNCED) {
      const raw = remote[field(k)];
      if (raw === undefined) continue;
      try {
        const v: Json = JSON.parse(raw);
        if (v !== null) write(k, v, true);
      } catch {
        /* a malformed remote value is ignored; the next local write repairs it */
      }
    }
    if (first) {
      first = false;
      const missing = SYNCED.filter((k) => remote[field(k)] === undefined && read(k) !== undefined);
      if (missing.length > 0) push?.([...missing]);
    }
  });
  return () => {
    off();
    push = null;
  };
}
