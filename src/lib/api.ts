import { useEffect, useState } from "react";
import { z } from "zod";
import { overCap, recordUsage, type Provider } from "./spend";

const Status = z.record(z.string(), z.boolean());
const Usage = z.record(z.string(), z.tuple([z.number(), z.number()]));
let status: Promise<Record<string, boolean>> | null = null;

/**
 * Calls one of our own /api routes (the ones that hold the OpenAI, Jev, Perplexity and GitHub keys).
 * Returns null when the route isn't available, so every caller keeps its free fallback:
 * on the deployed site that means "not signed in", in `npm run dev` the local server answers without a login.
 * A route whose key isn't configured is skipped after one cheap status check, so there are no failing requests.
 * Billable routes also stop once today's token cap is reached, and their token use is recorded from `x-usage`.
 */
export async function callApi(path: string, token: () => Promise<string | null>, init?: RequestInit): Promise<Response | null> {
  try {
    const t = await token();
    if (!t && !import.meta.env.DEV) return null;
    const headers = { ...init?.headers, ...(t ? { Authorization: `Bearer ${t}` } : {}) };

    status ??= fetch("/api/status", { headers })
      .then(async (r) => (r.ok ? Status.parse(await r.json()) : {}))
      .catch(() => ({}));
    const name = path.replace(/^\/api\//, "");
    if (!(await status)[name]) return null;
    if (name !== "github" && name !== "vercel" && overCap()) return null;

    const res = await fetch(path, { ...init, headers });
    if (!res.ok) return null;
    const usage = Usage.safeParse(JSON.parse(res.headers.get("x-usage") ?? "{}"));
    if (usage.success) recordUsage(usage.data as Partial<Record<Provider, [number, number]>>);
    return res;
  } catch {
    return null;
  }
}

/** Whether a route is configured, for hiding buttons that would do nothing. */
export function useApiReady(name: string, token: () => Promise<string | null>): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void token().then(async (t) => {
      if (!t && !import.meta.env.DEV) return;
      status ??= fetch("/api/status", { headers: t ? { Authorization: `Bearer ${t}` } : {} })
        .then(async (r) => (r.ok ? Status.parse(await r.json()) : {}))
        .catch(() => ({}));
      const s = await status;
      if (live) setReady(Boolean(s[name]));
    });
    return () => {
      live = false;
    };
  }, [name, token]);
  return ready;
}
