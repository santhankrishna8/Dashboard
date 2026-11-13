import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Card } from "../ui/Card";

const MODES = { Focus: 25 * 60, Break: 5 * 60 } as const;
type Mode = keyof typeof MODES;

export function FocusWidget() {
  const [mode, setMode] = useState<Mode>("Focus");
  const [left, setLeft] = useState<number>(MODES.Focus);
  const [running, setRunning] = useState(false);
  const endsAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    endsAt.current = Date.now() + left * 1000;
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) setRunning(false);
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

  return (
    <Card title="Focus">
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
      </div>
    </Card>
  );
}
