import { useEffect, useState } from "react";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, MapPin, Pencil, Sun, type LucideIcon } from "lucide-react";
import { z } from "zod";
import { Card, Async, RefreshBtn } from "../ui/Card";
import { getJson, useFeed } from "../lib/feed";
import { Count } from "../ui/Count";
import { getSynced, useSynced } from "../lib/sync";

const Geo = z.object({
  results: z
    .array(z.object({ name: z.string(), latitude: z.number(), longitude: z.number(), country: z.string().optional(), timezone: z.string().optional() }))
    .optional(),
});
const Forecast = z.object({
  current: z.object({
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
  }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
  }),
});
const Air = z.object({
  current: z.object({ us_aqi: z.number().nullish(), pm2_5: z.number().nullish(), pm10: z.number().nullish() }),
});

const WMO = (c: number): string =>
  c === 0 ? "Clear" : c === 1 ? "Mostly clear" : c === 2 ? "Partly cloudy" : c === 3 ? "Overcast"
  : c === 45 || c === 48 ? "Fog" : c >= 51 && c <= 57 ? "Drizzle" : c >= 61 && c <= 67 ? "Rain"
  : c >= 71 && c <= 77 ? "Snow" : c >= 80 && c <= 82 ? "Showers" : c >= 85 && c <= 86 ? "Snow showers"
  : c >= 95 ? "Thunderstorm" : "Mixed";

const icon = (c: number): LucideIcon =>
  c <= 1 ? Sun : c === 2 ? CloudSun : c === 3 ? Cloud : c === 45 || c === 48 ? CloudFog : c >= 51 && c <= 57 ? CloudDrizzle
  : (c >= 61 && c <= 67) || (c >= 80 && c <= 82) ? CloudRain : (c >= 71 && c <= 77) || c === 85 || c === 86 ? CloudSnow : c >= 95 ? CloudLightning : Cloud;

/** US EPA bands. The label always ships with the colour. */
const band = (aqi: number): { label: string; key: string } =>
  aqi <= 50 ? { label: "Good", key: "good" }
  : aqi <= 100 ? { label: "Moderate", key: "mod" }
  : aqi <= 150 ? { label: "Unhealthy for sensitive groups", key: "usg" }
  : aqi <= 200 ? { label: "Unhealthy", key: "bad" }
  : aqi <= 300 ? { label: "Very unhealthy", key: "vbad" }
  : { label: "Hazardous", key: "haz" };

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
/** "Asia/Kolkata" and "Asia/Calcutta" are the same zone; compare their canonical form. */
const canon = (tz: string): string => {
  try {
    return Intl.DateTimeFormat("en", { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return tz;
  }
};
// Legacy zone names that the geocoder doesn't know under that spelling.
const ALIAS: Record<string, string> = { Calcutta: "Kolkata", Saigon: "Ho Chi Minh City", Katmandu: "Kathmandu", Rangoon: "Yangon", Kiev: "Kyiv" };
const defaultCity = () => {
  const name = (localTz.split("/").pop() ?? "London").replace(/_/g, " ");
  return ALIAS[name] ?? name;
};

interface Loc {
  lat: number;
  lon: number;
  name: string;
}
const ASKED_KEY = "sd:loc-asked";
const validLoc = (v: Partial<Loc> | null): Loc | null => (v && typeof v.lat === "number" && typeof v.lon === "number" ? { lat: v.lat, lon: v.lon, name: v.name ?? "Your location" } : null);

const Rev = z.object({ city: z.string().optional(), locality: z.string().optional(), principalSubdivision: z.string().optional(), countryName: z.string().optional() });

/** Keyless reverse lookup, only to put a readable name on the card. Failing it never blocks the forecast. */
async function nameFor(lat: number, lon: number): Promise<string> {
  try {
    const r = Rev.parse(await getJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`));
    const place = r.city || r.locality || r.principalSubdivision;
    return place ? `${place}${r.countryName ? `, ${r.countryName}` : ""}` : "Your location";
  } catch {
    return "Your location";
  }
}

/** Triggers the browser's own permission prompt. Coordinates are rounded to ~1 km before they are stored or used. */
function locate(): Promise<Loc> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This browser can't share a location. Type a city instead."));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        void nameFor(lat, lon).then((name) => resolve({ lat, lon, name }));
      },
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location is blocked for this site. Allow it in the browser's site settings, or type a city."
              : "Couldn't work out where you are. Type a city instead.",
          ),
        ),
      { timeout: 15_000, maximumAge: 10 * 60_000 },
    );
  });
}

export function WeatherWidget() {
  const [cityRaw, setCity] = useSynced<string>("sd:city", defaultCity());
  const city = ALIAS[cityRaw] ?? cityRaw;
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [locRaw, setLoc] = useSynced<Loc | null>("sd:loc", null);
  const loc = validLoc(locRaw);
  const [locErr, setLocErr] = useState("");
  const want = loc ? `@${loc.lat},${loc.lon}` : city;

  const feed = useFeed(
    "weather",
    async () => {
      let lat: number;
      let lon: number;
      let place: string;
      if (loc) {
        ({ lat, lon } = loc);
        place = loc.name;
      } else {
        const found = Geo.parse(await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=5&name=${encodeURIComponent(city)}`)).results ?? [];
        // Legacy zone names ("Asia/Calcutta") can match a different town; prefer the match in your own timezone.
        const g = found.find((r) => r.timezone && canon(r.timezone) === canon(localTz)) ?? found[0];
        if (!g) throw new Error(`No place called “${city}”`);
        lat = g.latitude;
        lon = g.longitude;
        place = `${g.name}${g.country ? `, ${g.country}` : ""}`;
      }
      const q = `latitude=${lat}&longitude=${lon}`;
      const [f, air] = await Promise.all([
        getJson(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`).then((j) => Forecast.parse(j)),
        getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=us_aqi,pm2_5,pm10`).then((j) => Air.parse(j).current).catch(() => null),
      ]);
      return { q: want, place, ...f, air };
    },
    15 * 60_000,
  );

  // One shared "weather" feed (the top bar reads it too), so a new city means a reload, not a new key.
  const loadedFor = feed.data?.q;
  const { refresh } = feed;
  useEffect(() => {
    if (loadedFor !== undefined && loadedFor !== want) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, loadedFor]);

  const askForLocation = async () => {
    setLocErr("");
    try {
      const l = await locate();
      setLoc(l);
    } catch (e) {
      setLocErr(e instanceof Error ? e.message : "Couldn't get your location.");
    }
  };

  // First visit: ask once. The browser shows its own prompt, and a "no" is remembered so it never nags.
  useEffect(() => {
    if (validLoc(getSynced<Loc | null>("sd:loc", null))) return;
    try {
      if (localStorage.getItem(ASKED_KEY)) return;
      localStorage.setItem(ASKED_KEY, "1");
    } catch {
      /* ignore */
    }
    void askForLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => {
    const v = draft.trim();
    if (v && (v !== city || loc)) {
      setCity(v);
      setLoc(null);
      setLocErr("");
    }
    setEditing(false);
  };

  return (
    <Card
      title="Weather and air"
      actions={
        <>
          {editing ? (
            <input
              className="mini-input"
              autoFocus
              value={draft}
              placeholder="City"
              aria-label="City"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => (e.key === "Enter" ? submit() : e.key === "Escape" ? setEditing(false) : undefined)}
              onBlur={submit}
            />
          ) : (
            <button className="icon" onClick={() => { setDraft(city); setEditing(true); }} aria-label="Change city" title="Change city"><Pencil size={15} strokeWidth={1.75} /></button>
          )}
          <button className="icon" onClick={() => void askForLocation()} aria-pressed={!!loc} aria-label={loc ? "Update my location" : "Use my location"} title={loc ? "Using your location. Click to update." : "Use my location"}>
            <MapPin size={15} strokeWidth={1.75} />
          </button>
          <RefreshBtn feed={feed} label="weather" />
        </>
      }
    >
      {locErr ? <p className="stale" role="status">{locErr}</p> : null}
      <Async feed={feed} rows={3}>
        {(w) => {
          const aqi = w.air?.us_aqi ?? null;
          const b = aqi === null ? null : band(Math.round(aqi));
          return (
            <div className="weather">
              <p className="wx-place" title={w.place}><MapPin size={13} strokeWidth={1.75} aria-hidden="true" />{w.place}</p>
              <div className="now">
                {(() => {
                  const Icon = icon(w.current.weather_code);
                  return <Icon className="wx-icon" size={44} strokeWidth={1.25} aria-hidden="true" />;
                })()}
                <span className="temp"><Count value={Math.round(w.current.temperature_2m)} />°</span>
                <div>
                  <strong>{WMO(w.current.weather_code)}</strong>
                  <span className="muted">
                    feels {Math.round(w.current.apparent_temperature)}° · {w.current.relative_humidity_2m}% humidity · {Math.round(w.current.wind_speed_10m)} km/h
                  </span>
                </div>
              </div>
              {b && aqi !== null ? (
                <div className="aqi" data-band={b.key}>
                  <span className="num aqi-n"><Count value={Math.round(aqi)} /></span>
                  <div className="aqi-body">
                    <span className="aqi-t"><strong>Air quality · {b.label}</strong><span className="muted">US AQI{w.air?.pm2_5 != null ? ` · PM2.5 ${Math.round(w.air.pm2_5)} µg/m³` : ""}{w.air?.pm10 != null ? ` · PM10 ${Math.round(w.air.pm10)}` : ""}</span></span>
                    <span className="aqi-scale" role="img" aria-label={`${Math.round(aqi)} on a scale from good to very unhealthy`}>
                      <i /><i /><i /><i /><i />
                      <b style={{ left: `${Math.min(aqi, 300) / 3}%` }} />
                    </span>
                  </div>
                </div>
              ) : (
                <p className="stale">Air quality isn't available for this place right now.</p>
              )}
              <ul className="days">
                {(() => {
                  const lo = Math.min(...w.daily.temperature_2m_min);
                  const hi = Math.max(...w.daily.temperature_2m_max);
                  const span = hi - lo || 1;
                  return w.daily.time.map((d, i) => {
                    const Icon = icon(w.daily.weather_code[i] ?? 0);
                    const dmin = w.daily.temperature_2m_min[i] ?? 0;
                    const dmax = w.daily.temperature_2m_max[i] ?? 0;
                    return (
                      <li key={d} title={WMO(w.daily.weather_code[i] ?? 0)}>
                        <span>{i === 0 ? "Today" : new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(d))}</span>
                        <Icon size={16} strokeWidth={1.5} className="muted" aria-hidden="true" />
                        <span className="sr">{WMO(w.daily.weather_code[i] ?? 0)}</span>
                        <span className="num muted">{Math.round(dmin)}°</span>
                        <span className="range" aria-hidden="true"><i style={{ left: `${((dmin - lo) / span) * 100}%`, width: `${Math.max(6, ((dmax - dmin) / span) * 100)}%` }} /></span>
                        <span className="num">{Math.round(dmax)}°</span>
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          );
        }}
      </Async>
    </Card>
  );
}
