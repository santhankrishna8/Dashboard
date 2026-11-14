import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Card } from "../ui/Card";
import { useSynced } from "../lib/sync";

const MODES = { Focus: 25 * 60, Break: 5 * 60 } as const;
type Mode = keyof typeof MODES;

const dayKey = (d: Date) => d.toLocaleDateString("en-CA");
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);

export function FocusWidget() {
  const [mode, setMode] = useState<Mode>("Focus");
  const [left, setLeft] = useState<number>(MODES.Focus);
  const [running, setRunning] = useState(false);
  const endsAt = useRef(0);
  const logged = useRef(false);
  /** Minutes of completed focus sessions per local day, kept for the last 30 days. */
  const [log, setLog] = useSynced<Record<string, number>>("sd:focuslog", {});

  useEffect(() => {
    if (!running) return;
    endsAt.current = Date.now() + left * 1000;
    logged.current = false;
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        setRunning(false);
        if (mode === "Focus" && !logged.current) {
          logged.current = true;
          const keep = dayKey(new Date(Date.now() - 30 * 86_400_000));
          const k = dayKey(new Date());
          setLog((l) => ({ ...Object.fromEntries(Object.entries(l).filter(([d]) => d >= keep)), [k]: (l[k] ?? 0) + MODES.Focus / 60 }));
        }
      }
    }, 250);
    return () => window.clearInterval(id);
    // `left` is read once when the run starts; the interval owns it afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const mm = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  useEffect(() => {
    document.title = running ? `${mm} · Signal Desk` : "Signal Desk";
    return () => { document.title = "Signal Desk"; };
  }, [running, mm]);

  const R = 38;
  const C = 2 * Math.PI * R;
  const done = 1 - left / MODES[mode];
  const pick = (m: Mode) => { setRunning(false); setMode(m); setLeft(MODES[m]); };

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { key: dayKey(d), label: d.toLocaleDateString([], { weekday: "narrow" }), min: log[dayKey(d)] ?? 0, today: i === 6 };
  });
  const total = week.reduce((a, d) => a + d.min, 0);
  const peak = Math.max(60, ...week.map((d) => d.min));

  return (
    <Card title="Focus" meta={total > 0 ? `${hm(week[6]?.min ?? 0)} today · ${hm(total)} this week` : undefined}>
      <div className="focus">
        <div className="ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={R} className="ring-bg" />
            <circle cx="50" cy="50" r={R} className="ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - done)} />
          </svg>
          <span className="num" role="timer" aria-label={`${mm} left`}>{mm}</span>
        </div>
        <div className="focus-ctl">
          <div className="seg" role="group" aria-label="Timer mode">
            {(Object.keys(MODES) as Mode[]).map((m) => (
              <button key={m} aria-pressed={m === mode} onClick={() => pick(m)}>{m}</button>
            ))}
          </div>
          <div className="row-btns">
            <button className="btn primary" onClick={() => setRunning((r) => (left === 0 ? (setLeft(MODES[mode]), true) : !r))}>
              {running ? <Pause size={15} /> : <Play size={15} />} {running ? "Pause" : left === 0 ? "Again" : "Start"}
            </button>
            <button className="icon" onClick={() => pick(mode)} aria-label="Reset timer"><RotateCcw size={15} /></button>
          </div>
        </div>
        <div className="fweek" role="img" aria-label={`Focus minutes, last 7 days: ${week.map((d) => `${d.key} ${d.min}`).join(", ")}`}>
          {week.map((d) => (
            <span key={d.key} className={d.today ? "today" : undefined} title={`${d.key}: ${d.min} min`}>
              <i style={{ height: `${d.min > 0 ? Math.max(8, (d.min / peak) * 100) : 4}%` }} data-empty={d.min === 0 || undefined} />
              <small>{d.label}</small>
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
