import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { Card } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { useSynced } from "../lib/sync";

interface Deadline {
  id: string;
  label: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
}

const MAX = 40;
const DAY = 86_400_000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Whole calendar days from today (negative once it has passed). Parsed as local, never UTC, so it can't be off by one. */
const daysLeft = (date: string): number => {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round((new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime() - midnight(new Date())) / DAY);
};
const when = (n: number): string => (n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : n > 0 ? `in ${n} days` : `${-n} days ago`);

/** Exams, applications, launches: things with a date. Counts down in whole days; past ones stay (muted) until you clear them. */
export function DeadlinesWidget() {
  const [items, setItems] = useSynced<Deadline[]>("sd:deadlines", []);
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");

  const add = (e: FormEvent) => {
    e.preventDefault();
    const l = label.trim().slice(0, 80);
    if (!l || !/^\d{4}-\d{2}-\d{2}$/.test(date) || items.length >= MAX) return;
    setItems((list) => [...list, { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, label: l, date }]);
    setLabel("");
    setDate("");
  };

  const sorted = items.map((d) => ({ ...d, n: daysLeft(d.date) })).sort((a, b) => Number(a.n < 0) - Number(b.n < 0) || (a.n < 0 ? b.n - a.n : a.n - b.n));
  const next = sorted.find((d) => d.n >= 0);

  return (
    <Card title="Deadlines" meta={next ? `next: ${when(next.n).toLowerCase()}` : "dates that matter"}>
      <form className="dl-add" onSubmit={add}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What's due?" aria-label="What is due" maxLength={80} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Due date" />
        <button className="icon" type="submit" disabled={!label.trim() || !date || items.length >= MAX} aria-label="Add deadline">
          <Plus size={16} />
        </button>
      </form>
      <Paged
        items={sorted}
        rowH={36}
        empty={<p className="stale">No dates yet. Add an exam, an application or a launch and it counts down here.</p>}
        render={(d) => (
          <div className={`dl${d.n < 0 ? " past" : d.n <= 3 ? " soon" : ""}`} key={d.id}>
            <span className="dl-t" title={d.label}>{d.label}</span>
            <span className="muted dl-d">{new Date(d.date + "T00:00").toLocaleDateString([], { day: "numeric", month: "short" })}</span>
            <span className="num dl-n">{when(d.n)}</span>
            <button className="icon sm" onClick={() => setItems((l) => l.filter((x) => x.id !== d.id))} aria-label={`Remove ${d.label}`}>
              <X size={13} />
            </button>
          </div>
        )}
      />
    </Card>
  );
}
