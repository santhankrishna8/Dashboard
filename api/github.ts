import { z } from "zod";
import { json, requireOwner } from "./_lib/guard.js";

const Search = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      html_url: z.string(),
      updated_at: z.string(),
      draft: z.boolean().optional(),
      repository_url: z.string(),
    }),
  ),
});
const User = z.object({ login: z.string() });

/** Your open PRs and review requests. The token stays on the server; the browser only ever sees the lists. */
export async function GET(req: Request): Promise<Response> {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const token = process.env.GITHUB_TOKEN;
  if (!token) return json({ error: "GITHUB_TOKEN is not set" }, 503);

  const gh = (path: string) => fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "signal-desk" } });
  const find = async (q: string) => {
    const res = await gh(`/search/issues?per_page=20&sort=updated&q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    return Search.parse(await res.json()).items.map((i) => ({
      id: i.id,
      title: i.title,
      repo: i.repository_url.replace("https://api.github.com/repos/", ""),
      url: i.html_url,
      updated: i.updated_at,
      draft: i.draft,
    }));
  };

  try {
    const me = await gh("/user");
    if (!me.ok) return json({ error: `GitHub rejected the token (${me.status})` }, 502);
    const login = User.parse(await me.json()).login;
    const [mine, review] = await Promise.all([find("is:pr is:open author:@me archived:false"), find("is:pr is:open review-requested:@me archived:false")]);
    return json({ login, mine, review }, 200, "private, max-age=300");
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "GitHub failed" }, 502);
  }
}
