import { useEffect, useRef, useState, type CSSProperties } from "react";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { ListEditor } from "../ui/ListEditor";
import { getJson } from "../lib/feed";
import { useSynced } from "../lib/sync";
import { Card } from "../ui/Card";
import { Paged } from "../ui/Paged";

const DEFAULT_ZONES = [
  { name: "San Francisco", tz: "America/Los_Angeles" },
  { name: "New York", tz: "America/New_York" },
  { name: "London", tz: "Europe/London" },
  { name: "Dubai", tz: "Asia/Dubai" },
  { name: "Singapore", tz: "Asia/Singapore" },
  { name: "Tokyo", tz: "Asia/Tokyo" },
  { name: "Sydney", tz: "Australia/Sydney" },
];

interface Zone {
  name: string;
  tz: string;
}
const Geo = z.object({ results: z.array(z.object({ name: z.string(), timezone: z.string().optional() })).optional() });

const hm = (d: Date, tz?: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(d);

function parts(d: Date, tz?: string) {
  const f = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "numeric", day: "numeric", hour12: false, timeZone: tz }).formatToParts(d);
  const get = (t: string) => Number(f.find((p) => p.type === t)?.value ?? 0);
  return { h: get("hour") % 24, m: get("minute"), day: get("day") };
}

/** `tick` counts seconds since mount, so the hands only ever move forward and never spin back at 59 to 0. */
function useNow() {
  const [, render] = useState(0);
  const start = useRef(new Date());
  useEffect(() => {
    const id = window.setInterval(() => render((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  // Read the real clock on every render, so a throttled background tab catches up instead of running slow.
  const now = new Date();
  return { now, tick: Math.round((now.getTime() - start.current.getTime()) / 1000), start: start.current };
}

function Dial({ start, tick }: { start: Date; tick: number }) {
  const s0 = start.getSeconds();
  const m0 = start.getMinutes() + s0 / 60;
  const h0 = (start.getHours() % 12) + m0 / 60;
  const hand = (deg: number): CSSProperties => ({ transform: `rotate(${deg}deg)` });
  return (
    <svg className="dial" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="47" className="dial-face" />
      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0;
        return <line key={i} x1="50" y1={major ? 7 : 5.5} x2="50" y2={major ? 12.5 : 8} className={major ? "tick major" : "tick"} transform={`rotate(${i * 6} 50 50)`} />;
      })}
      <line x1="50" y1="52" x2="50" y2="28" className="hand hour" style={hand(h0 * 30 + tick / 120)} />
      <line x1="50" y1="54" x2="50" y2="17" className="hand min" style={hand(m0 * 6 + tick / 10)} />
      <line x1="50" y1="58" x2="50" y2="12" className="hand sec" style={hand((s0 + tick) * 6)} />
      <circle cx="50" cy="50" r="3" className="dial-pin" />
    </svg>
  );
}

export function ClocksWidget() {
  const [zones, setZones] = useSynced<Zone[]>("sd:watch:zones", DEFAULT_ZONES);
  const [editing, setEditing] = useState(false);
  const { now, tick, start } = useNow();
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDay = parts(now).day;
  const secs = String(now.getSeconds()).padStart(2, "0");

  return (
    <Card
      title="World clocks"
      meta={localTz.replace("_", " ")}
      actions={
        <button className="icon" aria-pressed={editing} onClick={() => setEditing((v) => !v)} aria-label={editing ? "Done editing clocks" : "Edit clocks"} title={editing ? "Done" : "Choose cities"}>
          <Pencil size={15} strokeWidth={1.75} />
        </button>
      }
    >
      <div className="clock-main">
        <Dial start={start} tick={tick} />
        <div className="clock-read">
          <time dateTime={now.toISOString()} className="big-time">
            {hm(now)}
            <small>{secs}</small>
          </time>
          <span className="muted">{new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(now)}</span>
        </div>
      </div>
      {editing ? (
        <ListEditor
          items={zones.map((z) => ({ id: z.tz + z.name, label: z.name }))}
          placeholder="City, e.g. Berlin"
          hint="Adds the city's local time."
          onRemove={(id) => setZones((l) => l.filter((z) => z.tz + z.name !== id))}
          onAdd={async (text) => {
            try {
              const hit = Geo.parse(await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=5&name=${encodeURIComponent(text)}`)).results?.find((r) => r.timezone);
              if (!hit?.timezone) return `Couldn't find a city called “${text}”.`;
              if (zones.some((z) => z.tz === hit.timezone && z.name === hit.name)) return `${hit.name} is already on the list.`;
              setZones((l) => [...l, { name: hit.name, tz: hit.timezone as string }]);
              return null;
            } catch {
              return "The city search didn't answer. Try again in a moment.";
            }
          }}
        />
      ) : (
      <Paged
        items={zones}
        rowH={30}
        render={(z) => {
          const p = parts(now, z.tz);
          const delta = p.day === localDay ? "" : (p.day > localDay && p.day - localDay < 15) || localDay - p.day > 15 ? "tomorrow" : "yesterday";
          const work = p.h >= 9 && p.h < 18;
          return (
            <div className="zone" key={z.tz}>
              <span>{z.name}</span>
              <span className="bar" aria-hidden="true">
                <i style={{ left: `${((p.h * 60 + p.m) / 1440) * 100}%` }} data-work={work} />
              </span>
              <span className="num">
                {hm(now, z.tz)}
                {delta ? <em>{delta}</em> : null}
              </span>
            </div>
          );
        }}
      />
      )}
    </Card>
  );
}
