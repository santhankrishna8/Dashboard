import { Card } from "../ui/Card";
import { useSynced } from "../lib/sync";

/** Quick capture. Press N anywhere to jump here. Saved as you type, and synced when you're signed in. */
export function PadWidget() {
  const [text, setText] = useSynced<string>("sd:pad", "");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <Card title="Scratchpad" meta={words ? `${words} word${words === 1 ? "" : "s"}` : "saved as you type"}>
      <label className="sr" htmlFor="pad">Scratchpad</label>
      <textarea id="pad" className="pad" value={text} onChange={(e) => setText(e.target.value)} placeholder="A thought, a link, a todo. It's kept." spellCheck />
    </Card>
  );
}
