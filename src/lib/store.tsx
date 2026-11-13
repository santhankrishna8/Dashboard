import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Candidate, Saved } from "./types";
import type { CloudUser } from "./firebase";
import { bindCloud } from "./sync";

export const hasFirebase = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);

type Cloud = typeof import("./firebase").cloud;
let cloudPromise: Promise<Cloud> | null = null;
const loadCloud = () => (cloudPromise ??= import("./firebase").then((m) => m.cloud));

const LS = "sd:saved";
const PASS = "sd:pass";
const readPass = (): string | null => {
  try {
    return localStorage.getItem(PASS);
  } catch {
    return null;
  }
};
/** Feed caches that may hold free-source fallbacks; cleared on unlock so the real routes are used straight away. */
const GATED = ["news", "judged", "lesson", "ideas", "github", "vercel"];
const readLocal = (): Saved[] => {
  try {
    return JSON.parse(localStorage.getItem(LS) ?? "[]") as Saved[];
  } catch {
    return [];
  }
};

interface Ctx {
  items: Saved[];
  has: (id: string) => boolean;
  toggle: (c: Candidate) => void;
  remove: (id: string) => void;
  user: CloudUser | null;
  mode: "local" | "cloud";
  signIn: () => void;
  signOut: () => void;
  token: () => Promise<string | null>;
  /** Passcode mode (no Firebase): whether this device has been unlocked, and how. */
  hasPass: boolean;
  unlock: (code: string) => Promise<string | null>;
  lock: () => void;
}

const SavedCtx = createContext<Ctx | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Saved[]>(readLocal);
  const [user, setUser] = useState<CloudUser | null>(null);
  const cloudRef = useRef<Cloud | null>(null);
  const [pass, setPass] = useState<string | null>(readPass);

  useEffect(() => {
    if (!hasFirebase) return;
    let off = () => {};
    void loadCloud().then((c) => {
      cloudRef.current = c;
      off = c.onUser(setUser);
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (!user || !cloudRef.current) return;
    return cloudRef.current.watchSaved(user.uid, (list) => setItems([...list].sort((a, b) => b.at - a.at)));
  }, [user]);

  useEffect(() => {
    if (!user || !cloudRef.current) return;
    const c = cloudRef.current;
    return bindCloud({ watch: (cb) => c.watchState(user.uid, cb), merge: (d) => c.mergeState(user.uid, d) });
  }, [user]);

  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(LS, JSON.stringify(items));
    } catch {
      /* private mode: saves last for this tab only */
    }
  }, [items, user]);

  const remove = useCallback(
    (id: string) => {
      setItems((l) => l.filter((x) => x.id !== id));
      if (user) void cloudRef.current?.del(user.uid, id);
    },
    [user],
  );

  const toggle = useCallback(
    (c: Candidate) => {
      if (items.some((x) => x.id === c.id)) return remove(c.id);
      const item: Saved = { ...c, at: Date.now() };
      setItems((l) => [item, ...l]);
      if (user) void cloudRef.current?.put(user.uid, item);
    },
    [items, user, remove],
  );

  const value = useMemo<Ctx>(
    () => ({
      items,
      has: (id) => items.some((x) => x.id === id),
      toggle,
      remove,
      user,
      mode: user ? "cloud" : "local",
      signIn: () => void loadCloud().then((c) => c.signIn()),
      signOut: () => void loadCloud().then((c) => c.signOut()),
      token: async () => (hasFirebase && user ? await loadCloud().then((c) => c.idToken()) : null) ?? readPass(),
      hasPass: pass !== null,
      unlock: async (code) => {
        const res = await fetch("/api/status", { headers: { Authorization: `Bearer ${code}` } }).catch(() => null);
        if (!res) return "Couldn't reach the server. Check your connection and try again.";
        if (res.status === 503) return "The server has no usable DASHBOARD_PASSCODE yet (it must be set, and at least 12 characters).";
        if (!res.ok) return "That passcode isn't right.";
        try {
          localStorage.setItem(PASS, code);
          for (const k of GATED) localStorage.removeItem(`sd:${k}`);
        } catch {
          /* private mode: unlocked for this tab only */
        }
        setPass(code);
        location.reload();
        return null;
      },
      lock: () => {
        try {
          localStorage.removeItem(PASS);
          for (const k of GATED) localStorage.removeItem(`sd:${k}`);
        } catch {
          /* ignore */
        }
        setPass(null);
        location.reload();
      },
    }),
    [items, toggle, remove, user, pass],
  );

  return <SavedCtx.Provider value={value}>{children}</SavedCtx.Provider>;
}

export function useSaved(): Ctx {
  const v = useContext(SavedCtx);
  if (!v) throw new Error("useSaved outside SavedProvider");
  return v;
}
