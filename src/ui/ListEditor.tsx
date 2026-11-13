import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";

interface Props {
  items: { id: string; label: string }[];
  /** Resolve with an error message to show, or null when the item was added. */
  onAdd: (text: string) => Promise<string | null>;
  onRemove: (id: string) => void;
  placeholder: string;
  hint: string;
}

/** Edit what a card tracks: chips you can remove, and one box to add another (validated against the real source). */
export function ListEditor({ items, onAdd, onRemove, placeholder, hint }: Props) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    const problem = await onAdd(v);
    setBusy(false);
    setErr(problem ?? "");
    if (!problem) setText("");
  };

  return (
    <div className="editor">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} aria-invalid={!!err} autoFocus />
        <button className="btn primary" type="submit" disabled={!text.trim() || busy}>
          <Plus size={14} /> {busy ? "Checking" : "Add"}
        </button>
      </form>
      {err ? <p className="form-err" role="alert">{err}</p> : <p className="muted editor-hint">{hint}</p>}
      <ul className="chip-list">
        {items.map((i) => (
          <li key={i.id}>
            <span>{i.label}</span>
            <button className="icon sm" onClick={() => onRemove(i.id)} aria-label={`Remove ${i.label}`}>
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
