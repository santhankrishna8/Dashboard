import { z } from "zod";
import { json, requireOwner, usageHeader } from "./_lib/guard.js";
import { judge } from "./_lib/jev.js";

const Body = z.object({
  items: z.array(z.object({ id: z.string().max(80), title: z.string().min(3).max(300) })).min(1).max(40),
  /** what the owner saved and dismissed, as plain text, so scoring follows their taste */
  hint: z.string().max(700).optional(),
});

/** Jev tags and scores headlines the browser already fetched (the free Hacker News path). */
export async function POST(req: Request): Promise<Response> {
  const denied = await requireOwner(req);
  if (denied) return denied;
  if (!process.env.TYPESAFE_API_KEY) return json({ error: "TYPESAFE_API_KEY is not set" }, 503);

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Send { items: [{ id, title }] } with at most 40 items" }, 400);

  const interests = process.env.INTERESTS ?? "AI agents, developer tools, new models";
  const used: [number, number] = [0, 0];
  const settled = await Promise.all(
    body.data.items.map(async (i) => {
      const v = await judge(i.title, interests, body.data.hint).catch(() => null);
      if (!v) return null;
      used[0] += v.usage[0];
      used[1] += v.usage[1];
      return { id: i.id, tag: v.tag, fit: v.fit };
    }),
  );
  return json({ results: settled.filter((r): r is NonNullable<typeof r> => r !== null) }, 200, "private, no-store", usageHeader({ jev: used }));
}
