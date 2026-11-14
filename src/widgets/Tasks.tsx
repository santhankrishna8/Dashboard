import { useEffect, useState, type FormEvent } from "react";
import { Check, Plus, X } from "lucide-react";
import { Card } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { useSynced } from "../lib/sync";

interface Task {
  id: string;
  text: string;
  done: boolean;
  /** Local date (YYYY-MM-DD) it was ticked off. Finished tasks disappear the next day; unfinished ones carry over. */
  doneOn?: string;
}

const MAX = 60;
const today = () => new Date().toLocaleDateString("en-CA");

/** What you mean to get done. Unfinished tasks roll over to tomorrow on their own; ticked ones clear after the day they were done. */
export function TasksWidget() {
  const [tasks, setTasks] = useSynced<Task[]>("sd:tasks", []);
  const [text, setText] = useState("");

  useEffect(() => {
    const t = today();
    if (tasks.some((k) => k.done && k.doneOn !== t)) setTasks((l) => l.filter((k) => !k.done || k.doneOn === t));
    // Prune once when the card mounts; later renders only show what's current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todo = tasks.filter((k) => !k.done);
  const done = tasks.filter((k) => k.done);
  const add = (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim().slice(0, 140);
    if (!v || tasks.length >= MAX) return;
    setTasks((l) => [...l, { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: v, done: false }]);
    setText("");
  };
  const toggle = (id: string) => setTasks((l) => l.map((k) => (k.id === id ? { ...k, done: !k.done, doneOn: k.done ? undefined : today() } : k)));

  return (
    <Card title="Tasks" meta={tasks.length === 0 ? "what must get done today" : todo.length === 0 ? "all done" : `${done.length} of ${tasks.length} done`}>
      <form className="task-add" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task and press Enter" aria-label="Add a task" maxLength={140} />
        <button className="icon" type="submit" disabled={!text.trim() || tasks.length >= MAX} aria-label="Add task">
          <Plus size={16} />
        </button>
      </form>
      <Paged
        items={[...todo, ...done]}
        rowH={36}
        empty={<p className="stale">Nothing planned. Add the one thing that would make today a good day.</p>}
        render={(k) => (
          <div className={`task${k.done ? " done" : ""}`} key={k.id}>
            <button className="tick" role="checkbox" aria-checked={k.done} onClick={() => toggle(k.id)} aria-label={`${k.done ? "Mark not done" : "Mark done"}: ${k.text}`}>
              {k.done ? <Check size={12} strokeWidth={3} /> : null}
            </button>
            <span className="task-t" title={k.text}>{k.text}</span>
            <button className="icon sm task-x" onClick={() => setTasks((l) => l.filter((x) => x.id !== k.id))} aria-label={`Delete ${k.text}`}>
              <X size={13} />
            </button>
          </div>
        )}
      />
    </Card>
  );
}
