import { z } from "zod";
import { getJson } from "./feed";

const Chart = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({ regularMarketPrice: z.number(), currency: z.string().optional(), regularMarketTime: z.number().optional(), shortName: z.string().optional() }),
          indicators: z.object({ quote: z.array(z.object({ close: z.array(z.number().nullable()) })) }),
        }),
      )
      .nullable(),
  }),
});

/** One quote through our /api/yahoo proxy (a Vercel rewrite in production, a Vite proxy in dev). Used by the metals card. */
export async function yahooQuote([symbol, name]: [string, string]) {
  const r = Chart.parse(await getJson(`/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`)).chart.result?.[0];
  if (!r) throw new Error(`No data for ${symbol}`);
  const closes = (r.indicators.quote[0]?.close ?? []).filter((n): n is number => n !== null);
  const price = r.meta.regularMarketPrice;
  const prev = closes.at(-2) ?? price;
  return { symbol, name: name === symbol ? (r.meta.shortName ?? symbol) : name, price, change: prev ? ((price - prev) / prev) * 100 : 0, closes, cur: r.meta.currency ?? "USD", at: (r.meta.regularMarketTime ?? 0) * 1000 };
}
