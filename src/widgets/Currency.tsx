import { useEffect, useState } from "react";
import { z } from "zod";
import { Card, Async, RefreshBtn } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { Spark } from "../ui/Spark";
import { getJson, useFeed } from "../lib/feed";
import { pct } from "../lib/fmt";
import { Pencil } from "lucide-react";
import { ListEditor } from "../ui/ListEditor";
import { useSynced } from "../lib/sync";

const BASES = ["USD", "EUR", "INR", "GBP"] as const;
const Codes = z.record(z.string(), z.string());
let codes: Promise<Record<string, string>> | null = null;
const currencyList = () => (codes ??= getJson("https://api.frankfurter.dev/v1/currencies").then((j) => Codes.parse(j)));
const DEFAULT_QUOTES = ["USD", "EUR", "INR", "GBP", "JPY", "AUD", "CAD", "CHF", "SGD"];

const Series = z.object({ rates: z.record(z.string(), z.record(z.string(), z.number())) });

export function CurrencyWidget() {
  const [quotes, setQuotes] = useSynced<string[]>("sd:watch:fx", DEFAULT_QUOTES);
  const [editing, setEditing] = useState(false);
  const [base, setBase] = useState<(typeof BASES)[number]>("USD");
  const [amount, setAmount] = useState("1");

  const feed = useFeed(
    `fx-${base}`,
    async () => {
      const wanted = quotes.filter((q) => q !== base);
      if (wanted.length === 0) return [];
      const start = new Date(Date.now() - 32 * 86_400_000).toISOString().slice(0, 10);
      const symbols = wanted.join(",");
      const j = Series.parse(await getJson(`https://api.frankfurter.dev/v1/${start}..?base=${base}&symbols=${symbols}`));
      const days = Object.keys(j.rates).sort();
      return wanted.map((code) => {
        const series = days.map((d) => j.rates[d]?.[code]).filter((n): n is number => typeof n === "number");
        const last = series.at(-1) ?? 0;
        const first = series[0] ?? last;
        return { code, last, series, change: first ? ((last - first) / first) * 100 : 0, q: quotes.join(",") };
      });
    },
    60 * 60_000,
  );

  // A changed list refreshes the feed in place (the top bar reads USD/INR from the same one).
  const want = quotes.join(",");
  const loadedFor = feed.data?.[0]?.q;
  const { refresh } = feed;
  useEffect(() => {
    if (loadedFor !== undefined && loadedFor !== want) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, loadedFor]);

  const amt = Number.parseFloat(amount.replace(/,/g, ""));
  const valid = Number.isFinite(amt) && amt >= 0;

  return (
    <Card
      title="Currencies"
      meta="30-day trend · ECB rates"
      actions={
        <>
          <button className="icon" aria-pressed={editing} onClick={() => setEditing((v) => !v)} aria-label={editing ? "Done editing currencies" : "Edit currencies"} title={editing ? "Done" : "Edit what's tracked"}>
            <Pencil size={15} strokeWidth={1.75} />
          </button>
          <RefreshBtn feed={feed} label="currencies" />
        </>
      }
    >
      {editing ? (
        <ListEditor
          items={quotes.map((id) => ({ id, label: id }))}
          placeholder="Currency code, e.g. AED"
          hint="Three-letter codes from the European Central Bank's list."
          onRemove={(id) => setQuotes((l) => l.filter((x) => x !== id))}
          onAdd={async (text) => {
            const code = text.toUpperCase().trim();
            if (quotes.includes(code)) return `${code} is already tracked.`;
            try {
              const all = await currencyList();
              if (!all[code]) return `${code} isn't one of the ECB's currencies.`;
            } catch {
              return "The rates service didn't answer. Try again in a moment.";
            }
            setQuotes((l) => [...l, code]);
            return null;
          }}
        />
      ) : (
        <>
      <div className="fx-bar">
        <label>
          <span className="sr">Amount</span>
          <input
            className="fx-input"
            inputMode="decimal"
            value={amount}
            aria-invalid={!valid}
            aria-label="Amount to convert"
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <div className="seg" role="group" aria-label="Base currency">
          {BASES.map((b) => (
            <button key={b} aria-pressed={b === base} onClick={() => setBase(b)}>{b}</button>
          ))}
        </div>
      </div>
      {!valid ? <p className="stale">Enter a number such as 250 or 1,200.50.</p> : null}
      <Async feed={feed} rows={4}>
        {(rows) => (
          <Paged
            items={rows}
            rowH={36}
            render={(r) => (
              <div className="fx-row" key={r.code}>
                <strong>{r.code}</strong>
                <span className="num fx-val">{valid ? new Intl.NumberFormat("en", { maximumFractionDigits: r.last * amt < 10 ? 3 : 2 }).format(r.last * amt) : "–"}</span>
                <span className={`num chg ${r.change >= 0 ? "up" : "down"}`}>{pct(r.change)}</span>
                <span className={r.change >= 0 ? "up" : "down"}><Spark values={r.series} /></span>
              </div>
            )}
          />
        )}
      </Async>
        </>
      )}
    </Card>
  );
}
