import { useSynced, getSynced, setSynced } from "./sync";

export type Provider = "openai" | "jev" | "perplexity";
export const PROVIDERS: Provider[] = ["openai", "jev", "perplexity"];
export const LABEL: Record<Provider, string> = { openai: "OpenAI", jev: "Jev", perplexity: "Perplexity" };

interface Day {
  date: string;
  p: Partial<Record<Provider, [number, number]>>;
}
export const DEFAULT_CAP = 150_000;
const day = () => new Date().toISOString().slice(0, 10);
const fresh = (): Day => ({ date: day(), p: {} });
const current = (): Day => {
  const d = getSynced<Day>("sd:spend", fresh());
  return d.date === day() ? d : fresh();
};

export const totalOf = (d: Day) => PROVIDERS.reduce((n, p) => n + (d.p[p]?.[0] ?? 0) + (d.p[p]?.[1] ?? 0), 0);

/** Tokens are counted from the `x-usage` header our routes send back, so the numbers are the providers' own. */
export function recordUsage(u: Partial<Record<Provider, [number, number]>>) {
  // Copy first: the store compares old and new by value, so mutating the stored object in place would look like "no change".
  const d: Day = JSON.parse(JSON.stringify(current()));
  for (const p of PROVIDERS) {
    const add = u[p];
    if (!add) continue;
    const had = d.p[p] ?? [0, 0];
    d.p[p] = [had[0] + (add[0] || 0), had[1] + (add[1] || 0)];
  }
  setSynced("sd:spend", d);
}

/** True once today's tokens reach the cap. Checked before every billable call. */
export const overCap = () => totalOf(current()) >= getSynced<number>("sd:cap", DEFAULT_CAP);

export function useSpend() {
  const [raw] = useSynced<Day>("sd:spend", fresh());
  const [cap, setCap] = useSynced<number>("sd:cap", DEFAULT_CAP);
  const today = raw.date === day() ? raw : fresh();
  const total = totalOf(today);
  return { today, total, cap, setCap, over: total >= cap };
}
