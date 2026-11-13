import { z } from "zod";
import { json, requireOwner, usageHeader } from "./_lib/guard.js";
import { askJson } from "./_lib/openai.js";

const Lesson = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  example: z.string(),
  quiz: z.object({ q: z.string(), options: z.tuple([z.string(), z.string(), z.string()]), answer: z.union([z.literal(0), z.literal(1), z.literal(2)]), why: z.string() }),
});

export async function GET(req: Request): Promise<Response> {
  const denied = await requireOwner(req);
  if (denied) return denied;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const { data: raw, usage } = await askJson(
      "You write one concise, accurate AI-engineering lesson per day for a working developer. Output JSON only.",
      `Date ${day}. Pick one concept a developer can use this week (not a basic definition of AI). JSON: {"id": kebab-case slug, "title": under 70 chars, "body": 2-3 sentences, "example": one concrete sentence, "quiz": {"q": question, "options": [3 strings], "answer": 0|1|2 index of the correct option, "why": one sentence}}.`,
      500,
    );
    return json(Lesson.parse(raw), 200, "private, max-age=21600", usageHeader({ openai: usage }));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Lesson failed" }, 502);
  }
}
