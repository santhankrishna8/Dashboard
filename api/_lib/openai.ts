/** One small JSON-mode chat call. The model id is yours to choose via OPENAI_MODEL. Returns the parsed JSON and the tokens used. */
export async function askJson(system: string, user: string, maxTokens: number): Promise<{ data: unknown; usage: [number, number] }> {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!key || !model) throw new Error("OPENAI_API_KEY and OPENAI_MODEL must both be set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI answered ${res.status}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  return {
    data: JSON.parse(body.choices[0]?.message.content ?? "{}"),
    usage: [body.usage?.prompt_tokens ?? 0, body.usage?.completion_tokens ?? 0],
  };
}
