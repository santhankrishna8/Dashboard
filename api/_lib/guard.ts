import { createHash, timingSafeEqual } from "node:crypto";

export const json = (body: unknown, status = 200, cache = "private, no-store", extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": cache, ...extra } });

/** Token use reported back to the browser, which keeps the daily tally: { openai: [in, out], jev: [in, out] }. */
export type Usage = Partial<Record<"openai" | "jev" | "perplexity", [number, number]>>;
export const usageHeader = (u: Usage): Record<string, string> => ({ "x-usage": JSON.stringify(u) });

const MIN_PASSCODE = 12;
const digest = (s: string) => createHash("sha256").update(s).digest();
/** Compares fixed-length digests in constant time, so response timing reveals nothing about the passcode. */
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Every route that spends money or reads your accounts calls this first. Two ways in, either of which is enough:
 *  - DASHBOARD_PASSCODE: a secret you choose, entered once per device on the site (no database or login needed).
 *  - Firebase: sign in with Google, and OWNER_UID names the one account allowed.
 * With neither configured the routes refuse everyone, and the app falls back to its free sources.
 */
export async function requireOwner(req: Request): Promise<Response | null> {
  // Only the local Vite dev server sets this (it listens on localhost). It is never set on Vercel.
  if (process.env.SD_LOCAL_DEV === "1") return null;

  const passcode = process.env.DASHBOARD_PASSCODE;
  const owner = process.env.OWNER_UID;
  const key = process.env.FIREBASE_WEB_API_KEY;
  const firebase = Boolean(owner && key);
  if (!passcode && !firebase) return json({ error: "Server routes are not configured: set DASHBOARD_PASSCODE" }, 503);
  if (passcode && passcode.length < MIN_PASSCODE && !firebase) return json({ error: `DASHBOARD_PASSCODE must be at least ${MIN_PASSCODE} characters` }, 503);

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unlock the dashboard first" }, 401);
  if (passcode && passcode.length >= MIN_PASSCODE && same(token, passcode)) return null;

  if (!firebase) {
    await sleep(600); // a wrong guess costs time, which blunts brute force on a stateless function
    return json({ error: "Wrong passcode" }, 401);
  }
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!res.ok) return json({ error: "Invalid session" }, 401);
  const data = (await res.json()) as { users?: { localId: string }[] };
  return data.users?.[0]?.localId === owner ? null : json({ error: "Not your dashboard" }, 403);
}
