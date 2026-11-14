import { useMemo, type ReactNode } from "react";
import { z } from "zod";
import { usePeek } from "../lib/feed";

/* The strip only reads what the cards already loaded, so it costs no extra requests. */
const Services = z.array(z.object({ name: z.string(), level: z.string(), text: z.string() }));
const Vercel = z.object({ configured: z.literal(true), total: z.number(), live: z.number() });
const Fx = z.array(z.object({ code: z.string(), last: z.number() }));
const Wx = z.object({
  place: z.string(),
  current: z.object({ temperature_2m: z.number() }),
  air: z.object({ us_aqi: z.number().nullish() }).nullish(),
});

function Item({ label, value, tone, change }: { label: string; value: ReactNode; tone?: "up" | "down"; change?: number | null }) {
  return (
    <span className="tk">
      <span className="muted">{label}</span>
      <b className={tone}>{value}</b>
      {typeof change === "number" ? (
        <span className={`num ${change >= 0 ? "up" : "down"}`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
        </span>
      ) : null}
    </span>
  );
}

export function Ticker() {
  const status = usePeek("status");
  const vercel = Vercel.safeParse(usePeek("vercel"));
  const fx = usePeek("fx-USD");
  const weather = usePeek("weather");

  const items = useMemo(() => {
    const out: ReactNode[] = [];
    const wx = Wx.safeParse(weather);
    if (wx.success) {
      const aqi = wx.data.air?.us_aqi;
      out.push(<Item key="wx" label={wx.data.place.split(",")[0] ?? ""} value={`${Math.round(wx.data.current.temperature_2m)}°`} />);
      if (typeof aqi === "number") out.push(<Item key="aqi" label="AQI" value={Math.round(aqi)} />);
    }
    // GitHub always; any other service only when it is having a bad day.
    const s = Services.safeParse(status);
    if (s.success)
      for (const svc of s.data)
        if (svc.name === "GitHub" || svc.level === "minor" || svc.level === "major")
          out.push(<Item key={svc.name} label={svc.name} value={svc.level === "ok" ? "Operational" : svc.text} tone={svc.level === "ok" ? "up" : "down"} />);
    if (vercel.success) out.push(<Item key="vercel" label="Vercel" value={`${vercel.data.live}/${vercel.data.total} live`} tone={vercel.data.live === vercel.data.total ? "up" : "down"} />);
    const f = Fx.safeParse(fx);
    const inr = f.success ? f.data.find((x) => x.code === "INR") : undefined;
    if (inr) out.push(<Item key="inr" label="USD/INR" value={inr.last.toFixed(2)} />);
    return out;
  }, [status, vercel, fx, weather]);

  return (
    <div className="ticker" role="group" aria-label="Key numbers">
      <span className="tk">
        <span className="muted">{new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short" }).format(new Date())}</span>
      </span>
      {items}
    </div>
  );
}
