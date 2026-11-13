import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { z } from "zod";
import { Card } from "../ui/Card";
import { SaveButton } from "../ui/Save";
import { LESSONS, type Lesson } from "../data/lessons";
import { IDEAS, type Idea } from "../data/ideas";
import { useFeed } from "../lib/feed";
import { useSaved } from "../lib/store";
import { callApi, useApiReady } from "../lib/api";
import { useSynced } from "../lib/sync";
import { recordMiss } from "../lib/misses";

const dayNumber = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);
const today = () => new Date(dayNumber() * 86_400_000).toISOString().slice(0, 10);

/* Streak: consecutive days with a correct answer. Synced when you're signed in. */
interface Streak { last: string; count: number; done: string }
const NO_STREAK: Streak = { last: "", count: 0, done: "" };

const Remote = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  example: z.string(),
  quiz: z.object({ q: z.string(), options: z.tuple([z.string(), z.string(), z.string()]), answer: z.union([z.literal(0), z.literal(1), z.literal(2)]), why: z.string() }),
});

export function LessonWidget() {
  const { token } = useSaved();
  const feed = useFeed<Lesson & { day: string }>(
    "lesson",
    async () => {
      const res = await callApi("/api/lesson", token);
      if (res) {
        const parsed = Remote.safeParse(await res.json().catch(() => null));
        if (parsed.success) return { ...parsed.data, day: today() };
      }
      return { ...(LESSONS[dayNumber() % LESSONS.length] as Lesson), day: today() };
    },
    6 * 3_600_000,
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [streak, setStreak] = useSynced<Streak>("sd:streak", NO_STREAK);

  // A cached lesson from yesterday must not be shown as today's.
  const stale = feed.data && feed.data.day !== today();
  const lesson = stale ? ({ ...(LESSONS[dayNumber() % LESSONS.length] as Lesson), day: today() }) : feed.data;

  const answer = (i: number) => {
    if (picked !== null || !lesson) return;
    setPicked(i);
    if (i !== lesson.quiz.answer) {
      recordMiss({ id: lesson.id, title: lesson.title, q: lesson.quiz.q, options: lesson.quiz.options, answer: lesson.quiz.answer, why: lesson.quiz.why });
      return;
    }
    if (streak.done === today()) return;
    const yesterday = new Date((dayNumber() - 1) * 86_400_000).toISOString().slice(0, 10);
    const next = { last: today(), done: today(), count: streak.last === yesterday ? streak.count + 1 : 1 };
    setStreak(next);
  };

  return (
    <Card
      title="Learn one thing"
      meta={`day streak ${streak.last === today() || streak.last === new Date((dayNumber() - 1) * 86_400_000).toISOString().slice(0, 10) ? streak.count : 0}`}
      actions={lesson ? <SaveButton item={{ id: `lesson-${lesson.id}`, kind: "lesson", title: lesson.title, note: lesson.body }} /> : undefined}
    >
      {lesson ? (
        <div className="lesson">
          <div className="lesson-text">
            <h3>{lesson.title}</h3>
            <p>{lesson.body}</p>
            <p className="example">{lesson.example}</p>
          </div>
          <div className="quiz">
            <p className="q">{lesson.quiz.q}</p>
            <div className="opts">
              {lesson.quiz.options.map((o, i) => (
                <button
                  key={o}
                  className="opt"
                  disabled={picked !== null}
                  data-state={picked === null ? "" : i === lesson.quiz.answer ? "right" : i === picked ? "wrong" : ""}
                  onClick={() => answer(i)}
                >
                  {o}
                </button>
              ))}
            </div>
            <p className="why" aria-live="polite">
              {picked === null ? "" : `${picked === lesson.quiz.answer ? "Correct. " : "Not quite. "}${lesson.quiz.why}`}
            </p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

const PlanShape = z.object({ steps: z.array(z.string()), firstHour: z.string(), watchOut: z.string() });
type PlanData = z.infer<typeof PlanShape>;
const planText = (p: PlanData) => `First hour: ${p.firstHour}\n\n${p.steps.map((x, n) => `${n + 1}. ${x}`).join("\n")}\n\nWatch out: ${p.watchOut}`;

const RemoteIdeas = z.array(z.object({ id: z.string(), title: z.string(), pitch: z.string(), stack: z.string(), effort: z.enum(["a day", "a weekend", "a week"]) }));

export function IdeasWidget() {
  const { token, has } = useSaved();
  const canPlan = useApiReady("plan", token);
  const [plan, setPlan] = useState<{ for: string; data: PlanData } | { for: string; error: string } | { for: string; busy: true } | null>(null);
  const feed = useFeed<Idea[]>(
    "ideas",
    async () => {
      const res = await callApi("/api/ideas", token);
      if (res) {
        const parsed = RemoteIdeas.safeParse(await res.json().catch(() => null));
        if (parsed.success) return parsed.data;
      }
      return IDEAS;
    },
    24 * 3_600_000,
  );
  const [i, setI] = useState(() => dayNumber() % IDEAS.length);
  const list = feed.data ?? IDEAS;
  const idea = list[i % list.length] as Idea;
  const next = () => {
    let n = (i + 1) % list.length;
    for (let k = 0; k < list.length && has(`idea-${(list[n] as Idea).id}`); k++) n = (n + 1) % list.length;
    setI(n);
    setPlan(null);
  };

  const makePlan = async () => {
    setPlan({ for: idea.id, busy: true });
    const res = await callApi("/api/plan", token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: idea.title, pitch: idea.pitch, stack: idea.stack }) });
    const parsed = res ? PlanShape.safeParse(await res.json().catch(() => null)) : null;
    setPlan(parsed?.success ? { for: idea.id, data: parsed.data } : { for: idea.id, error: res ? "The plan came back in a shape I couldn't read. Try again." : "Planning is paused or unavailable right now." });
  };
  const shown = plan && plan.for === idea.id ? plan : null;

  return (
    <Card
      title="Try building this"
      meta={`${idea.effort} · ${(i % list.length) + 1} of ${list.length}`}
      actions={
        <>
          {canPlan && !shown ? <button className="btn" onClick={() => void makePlan()}><Sparkles size={14} /> Plan it</button> : null}
          {shown ? <button className="btn" onClick={() => setPlan(null)}><ArrowLeft size={14} /> Back</button> : <button className="btn" onClick={next}>Another idea</button>}
        </>
      }
    >
      {shown && "data" in shown ? (
        <div className="plan">
          <div className="plan-head">
            <h3>Plan: {idea.title}</h3>
            <SaveButton item={{ id: `plan-${idea.id}`, kind: "idea", title: `Plan: ${idea.title}`, note: planText(shown.data) }} />
          </div>
          <p><strong>First hour.</strong> {shown.data.firstHour}</p>
          <ol>{shown.data.steps.map((x) => <li key={x}>{x}</li>)}</ol>
          <p className="muted"><strong>Watch out.</strong> {shown.data.watchOut}</p>
        </div>
      ) : shown && "busy" in shown ? (
        <div className="skel" role="status" aria-label="Planning"><i style={{ width: "70%" }} /><i style={{ width: "92%" }} /><i style={{ width: "84%" }} /><i style={{ width: "60%" }} /></div>
      ) : (
        <div className="idea">
          <div>
            <h3>{idea.title}</h3>
            <p>{idea.pitch}</p>
            <p className="muted stack">{idea.stack}</p>
            {shown && "error" in shown ? <p className="stale" role="status">{shown.error}</p> : null}
          </div>
          <SaveButton item={{ id: `idea-${idea.id}`, kind: "idea", title: idea.title, note: idea.pitch }} />
        </div>
      )}
    </Card>
  );
}
