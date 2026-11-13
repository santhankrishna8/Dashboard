import { useState } from "react";
import { Card, Empty } from "../ui/Card";
import { useSynced } from "../lib/sync";
import { DAY, settle, type Miss } from "../lib/misses";

/** Questions you got wrong in the daily quiz, brought back on a widening schedule. */
export function ReviewWidget() {
  const [all] = useSynced<Miss[]>("sd:misses", []);
  const [picked, setPicked] = useState<number | null>(null);
  const now = Date.now();
  const due = all.filter((m) => m.due <= now).sort((a, b) => a.due - b.due);
  const next = all.filter((m) => m.due > now).sort((a, b) => a.due - b.due)[0];
  const cur = due[0];

  const answer = (i: number) => {
    if (picked !== null || !cur) return;
    setPicked(i);
  };
  const advance = () => {
    if (cur && picked !== null) settle(cur.id, picked === cur.answer);
    setPicked(null);
  };

  return (
    <Card title="Review your misses" meta={all.length === 0 ? "none yet" : `${due.length} due · ${all.length} tracked`}>
      {cur ? (
        <div className="review">
          <p className="review-from">From “{cur.title}”</p>
          <p className="q">{cur.q}</p>
          <div className="opts">
            {cur.options.map((o, i) => (
              <button key={o} className="opt" disabled={picked !== null} data-state={picked === null ? "" : i === cur.answer ? "right" : i === picked ? "wrong" : ""} onClick={() => answer(i)}>
                {o}
              </button>
            ))}
          </div>
          {picked !== null ? (
            <div className="review-after" aria-live="polite">
              <p className="why">{picked === cur.answer ? "Correct. It comes back later, further out. " : "Not yet. It comes back tomorrow. "}{cur.why}</p>
              <button className="btn primary" onClick={advance}>{due.length > 1 ? "Next question" : "Done"}</button>
            </div>
          ) : null}
        </div>
      ) : all.length === 0 ? (
        <Empty title="Nothing to review" hint="Get a quiz question wrong in Learn one thing and it comes back here, tomorrow and then at widening gaps." />
      ) : (
        <Empty title="All caught up" hint={next ? `Next question is due in ${Math.max(1, Math.ceil((next.due - now) / DAY))} day${Math.ceil((next.due - now) / DAY) > 1 ? "s" : ""}.` : undefined} />
      )}
    </Card>
  );
}
