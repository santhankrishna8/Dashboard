import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** `search` adds matching content (stories, saved items, links) once you've typed two letters; choosing one opens it. */
export function Palette({ open, onClose, commands, search }: { open: boolean; onClose: () => void; commands: Command[]; search?: (q: string) => Command[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQ("");
      setSel(0);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return commands;
    const found = t.length >= 2 && search ? search(t) : [];
    return [...commands.filter((c) => c.label.toLowerCase().includes(t)), ...found];
  }, [q, commands, search]);

  const run = (c?: Command) => {
    if (!c) return;
    onClose();
    c.run();
  };

  return (
    <dialog ref={ref} className="palette" aria-label="Command palette" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="p-in">
        <Search size={16} aria-hidden="true" />
        <input
          autoFocus
          value={q}
          placeholder="Jump to a desk, or search stories, saved items and links…"
          aria-label="Search commands"
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(shown.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter") run(shown[sel]);
          }}
        />
      </div>
      <ul role="listbox" aria-label="Commands">
        {shown.map((c, i) => (
          <li key={c.id} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
            <span className="p-label">{c.label}</span>
            {c.hint ? <kbd>{c.hint}</kbd> : i === sel ? <CornerDownLeft size={13} aria-hidden="true" /> : null}
          </li>
        ))}
        {shown.length === 0 ? <li className="none">Nothing matches “{q}”.</li> : null}
      </ul>
    </dialog>
  );
}
