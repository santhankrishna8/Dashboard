import { z } from "zod";
import { json, requireOwner } from "./_lib/guard.js";

const Deployment = z.object({
  url: z.string().optional(),
  readyState: z.string().optional(),
  createdAt: z.number().optional(),
  alias: z.array(z.string()).optional(),
  target: z.string().nullish(),
});
const Projects = z.object({
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      framework: z.string().nullish(),
      updatedAt: z.number().optional(),
      latestDeployments: z.array(Deployment).optional(),
      targets: z.object({ production: Deployment.nullish() }).nullish(),
    }),
  ),
});

/** Is the production site answering? Anything below 500 counts (a 401 means Vercel's deployment protection is on). */
async function probe(host: string): Promise<{ up: boolean; protectedSite: boolean }> {
  try {
    const res = await fetch(`https://${host}`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(4000) });
    return { up: res.status < 500, protectedSite: res.status === 401 || res.status === 403 };
  } catch {
    return { up: false, protectedSite: false };
  }
}

/** Your Vercel projects and whether each one's production deployment is live. The token stays on the server. */
export async function GET(req: Request): Promise<Response> {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const token = process.env.VERCEL_TOKEN ?? process.env.SD_VERCEL_TOKEN;
  if (!token) return json({ error: "VERCEL_TOKEN (or SD_VERCEL_TOKEN) is not set" }, 503);

  const team = process.env.VERCEL_TEAM_ID ?? process.env.SD_VERCEL_TEAM_ID;
  const res = await fetch(`https://api.vercel.com/v9/projects?limit=100${team ? `&teamId=${encodeURIComponent(team)}` : ""}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) return json({ error: "Vercel rejected the token. Check it, and VERCEL_TEAM_ID if the projects belong to a team." }, 502);
  if (!res.ok) return json({ error: `Vercel answered ${res.status}` }, 502);
  const parsed = Projects.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return json({ error: "Vercel returned something unexpected" }, 502);

  const projects = await Promise.all(
    parsed.data.projects.map(async (p) => {
      const prod = p.targets?.production ?? p.latestDeployments?.find((d) => d.target === "production") ?? null;
      const host = prod?.alias?.[0] ?? prod?.url;
      const state = prod?.readyState ?? "NONE";
      const check = state === "READY" && host ? await probe(host) : null;
      return {
        id: p.id,
        name: p.name,
        framework: p.framework ?? null,
        state,
        site: host ? `https://${host}` : null,
        at: prod?.createdAt ?? p.updatedAt ?? null,
        up: check ? check.up : null,
        protectedSite: check ? check.protectedSite : false,
      };
    }),
  );
  const live = projects.filter((p) => p.state === "READY" && p.up !== false).length;
  return json({ total: projects.length, live, projects }, 200, "private, max-age=120");
}
