import { z } from "zod";
import { json, requireOwner, usageHeader } from "./_lib/guard.js";
import { judge } from "./_lib/jev.js";

const Reply = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })),
  search_results: z.array(z.object({ url: z.string() })).optional(),
  usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() }).optional(),
  citations: z.array(z.string()).optional(),
});
const Items = z.array(z.object({ title: z.string().min(8), url: z.url(), tag: z.string().optional() }));

export async function GET(req: Request): Promise<Response> {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return json({ error: "PERPLEXITY_API_KEY is not set" }, 503);

  const interests = process.env.INTERESTS ?? "AI agents, developer tools, new models";
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar",
      max_tokens: 900,
      temperature: 0.1,
      search_recency_filter: "day",
      messages: [
        { role: "system", content: "Reply with a JSON array only, no prose and no code fences." },
        {
          role: "user",
          content: `List the 12 most significant AI news items from the last 24 hours that matter to developers (models, tools, research, business, policy). Each element: {"title": plain headline under 110 characters, "url": the source article URL}. Use only URLs you actually retrieved.`,
        },
      ],
    }),
  });
  if (!res.ok) return json({ error: `Perplexity answered ${res.status}` }, 502);

  const body = Reply.parse(await res.json());
  const real = new Set([...(body.citations ?? []), ...(body.search_results ?? []).map((s) => s.url)]);
  const text = body.choices[0]?.message.content.replace(/^```(?:json)?|```$/gm, "").trim() ?? "[]";
  const parsed = Items.safeParse(JSON.parse(text));
  if (!parsed.success) return json({ error: "Perplexity returned an unexpected shape" }, 502);

  // Drop anything whose link was not among the sources the search actually returned.
  const grounded = parsed.data.filter((i) => real.has(i.url));
  const jevUsed: [number, number] = [0, 0];
  const scored = await Promise.all(
    grounded.map(async (i) => {
      const v = await judge(i.title, interests);
      if (v) {
        jevUsed[0] += v.usage[0];
        jevUsed[1] += v.usage[1];
      }
      return { id: `px-${Buffer.from(i.url).toString("base64url").slice(-14)}`, title: i.title, url: i.url, tag: v?.tag ?? i.tag ?? "General", t: Date.now(), score: v?.fit };
    }),
  );
  const items = scored.filter((i) => i.score === undefined || i.score >= 0.34).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return json({ via: "perplexity", items }, 200, "private, max-age=3600", usageHeader({ perplexity: [body.usage?.prompt_tokens ?? 0, body.usage?.completion_tokens ?? 0], jev: jevUsed }));
}
