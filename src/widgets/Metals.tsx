import { z } from "zod";
import { Card, Async, RefreshBtn } from "../ui/Card";
import { Spark } from "../ui/Spark";
import { getJson, useFeed } from "../lib/feed";
import { pct } from "../lib/fmt";
import { yahooQuote } from "../lib/yahoo";

/** Bronze is an alloy with no market price; copper is its main metal, so it stands in. */
const METALS = [
  { sym: "GC=F", name: "Gold", unit: "oz", inrUnit: "g", div: 31.1035 },
  { sym: "SI=F", name: "Silver", unit: "oz", inrUnit: "g", div: 31.1035 },
  { sym: "HG=F", name: "Copper", unit: "lb", inrUnit: "kg", div: 0.45359237 },
] as const;

const Fx = z.object({ rates: z.object({ INR: z.number() }) });
const usd = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function MetalsWidget() {
  const feed = useFeed(
    "metals",
    async () => {
      const [rows, rate] = await Promise.all([
        Promise.allSettled(METALS.map((m) => yahooQuote([m.sym, m.name]))),
        getJson("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR").then((j) => Fx.parse(j).rates.INR).catch(() => null),
      ]);
      const ok = rows.flatMap((r, i) => (r.status === "fulfilled" ? [{ ...r.value, m: METALS[i] as (typeof METALS)[number] }] : []));
      if (ok.length === 0) throw new Error("Futures quotes unreachable");
      return { ok, rate };
    },
    10 * 60_000,
  );

  return (
    <Card title="Gold, silver, copper" meta="futures · delayed" actions={<RefreshBtn feed={feed} label="metals" />}>
      <Async feed={feed} rows={3}>
        {({ ok, rate }) => (
          <>
            <div className="metals">
              {ok.map((q) => (
                <div className="fx-row metal" key={q.symbol}>
                  <span className="who">
                    <strong>{q.name}</strong>
                    <span className="muted num">
                      {rate ? `≈ ${inr((q.price / q.m.div) * rate)} / ${q.m.inrUnit}` : `per ${q.m.unit}`}
                    </span>
                  </span>
                  <span className="num fx-val">{usd(q.price)}<small>/{q.m.unit}</small></span>
                  <span className={`num chg ${q.change >= 0 ? "up" : "down"}`}>{pct(q.change)}</span>
                  <span className={q.change >= 0 ? "up" : "down"}><Spark values={q.closes} /></span>
                </div>
              ))}
            </div>
            <p className="stale">Copper stands in for bronze, which isn't traded. ₹ figures are spot-based, before import duty and GST.</p>
          </>
        )}
      </Async>
    </Card>
  );
}
