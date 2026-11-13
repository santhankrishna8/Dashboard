import { z } from "zod";
import { json, requireOwner, usageHeader } from "./_lib/guard.js";
import { askJson } from "./_lib/openai.js";

const Ideas = z.object({
  ideas: z.array(z.object({ id: z.string(), title: z.string(), pitch: z.string(), stack: z.string(), effort: z.enum(["a day", "a weekend", "a week"]) })).min(3),
});

export async function GET(req: Request): Promise<Response> {
  const denied = await requireOwner(req);
  if (denied) return denied;
  try {
    const interests = process.env.INTERESTS ?? "AI agents, developer tools, web apps";
    const { data: raw, usage } = await askJson(
      "You suggest small, buildable software projects for one developer. Output JSON only.",
      `Interests: ${interests}. Suggest 6 distinct projects, each finishable in a day to a week, each teaching something real. JSON: {"ideas": [{"id": kebab-case slug, "title": under 60 chars, "pitch": 2 sentences on what it does and why it is worth building, "stack": short list joined by " · ", "effort": "a day" | "a weekend" | "a week"}]}.`,
      900,
    );
    return json(Ideas.parse(raw).ideas, 200, "private, max-age=43200", usageHeader({ openai: usage }));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Ideas failed" }, 502);
  }
}
