import { z } from "zod";

const Answer = z.object({
  answers: z.object({
    tag: z.object({ choice: z.string() }),
    fit: z.object({ score: z.number(), confidence: z.number().optional() }),
  }),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }).optional(),
});

const FIT_LEVELS = ["Not useful to them", "Somewhat useful", "Directly useful"];

export interface Verdict {
  tag: string;
  fit: number;
  usage: [number, number];
}

/**
 * Jev (TypeSafe AI) returns typed answers instead of text: one request carries the item
 * and both questions. Without TYPESAFE_API_KEY this returns null and callers keep unscored items.
 * `hint` carries what you saved and dismissed, so the rubric learns your taste.
 */
export async function judge(item: string, interests: string, hint = ""): Promise<Verdict | null> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      state: item,
      model: "jev-latest",
      questions: {
        tag: {
          type: "choice",
          instructions: "Which category best describes this AI news item?",
          criteria: {
            Model: "A new model or a model update",
            Tool: "A developer tool, library, API or agent framework",
            Research: "A research result, paper or benchmark",
            Business: "Funding, acquisitions or company news",
            Policy: "Regulation, law or safety policy",
            General: "None of the above",
          },
        },
        fit: {
          type: "score",
          instructions: `How useful is this to a developer who builds with AI and cares about: ${interests}?${hint ? ` ${hint}` : ""}`,
          criteria: FIT_LEVELS,
        },
      },
    }),
  });
  if (!res.ok) return null;
  const parsed = Answer.safeParse(await res.json());
  if (!parsed.success) return null;
  // Jev scores on the rubric's own scale: with three levels that is 0 to 2. Normalise to 0..1 for the rest of the app.
  const fit = Math.min(1, Math.max(0, parsed.data.answers.fit.score / (FIT_LEVELS.length - 1)));
  const u = parsed.data.usage;
  return { tag: parsed.data.answers.tag.choice, fit, usage: [u?.input_tokens ?? 0, u?.output_tokens ?? 0] };
}
