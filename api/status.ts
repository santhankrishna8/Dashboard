import { json, requireOwner } from "./_lib/guard.js";

/** Which upstream keys are set, as booleans only. Lets the app skip routes that would just answer 503. */
export async function GET(req: Request): Promise<Response> {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const e = process.env;
  const openai = Boolean(e.OPENAI_API_KEY && e.OPENAI_MODEL);
  return json({ news: Boolean(e.PERPLEXITY_API_KEY), lesson: openai, ideas: openai, judge: Boolean(e.TYPESAFE_API_KEY), plan: openai, github: Boolean(e.GITHUB_TOKEN), vercel: Boolean(e.VERCEL_TOKEN ?? e.SD_VERCEL_TOKEN) });
}
