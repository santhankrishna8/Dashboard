import { z } from "zod";
import { json, requireOwner, usageHeader } from "./_lib/guard.js";
import { askJson } from "./_lib/openai.js";

const Body = z.object({ title: z.string().min(3).max(120), pitch: z.string().min(3).max(500), stack: z.string().max(200).optional() });
const Plan = z.object({ steps: z.array(z.string()).min(3).max(7), firstHour: z.string(), watchOut: z.string() });

/** Turns one project idea into a short starter plan. One OpenAI call, only when you click "Plan it". */
export async function POST(req: Request): Promise<Response> {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Send { title, pitch, stack? }" }, 400);
  try {
    const { data, usage } = await askJson(
      "You are a pragmatic senior engineer helping one developer start a small project. Output JSON only.",
      `Project: ${body.data.title}. ${body.data.pitch}${body.data.stack ? ` Stack: ${body.data.stack}.` : ""}\nJSON: {"steps": 5 short imperative build steps in order, "firstHour": what to do in the first hour so there is something running, "watchOut": the one mistake most likely to waste their time}.`,
      450,
    );
    return json(Plan.parse(data), 200, "private, no-store", usageHeader({ openai: usage }));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Plan failed" }, 502);
  }
}
