import { Bookmark } from "lucide-react";
import { useSaved } from "../lib/store";
import type { Candidate } from "../lib/types";

/** A dot leaves the button and lands on the Saved tab. Transform and opacity only. */
function fly(from: HTMLElement) {
  // Land on the Saved card when it is on the visible desk, otherwise on the tab of the desk that holds it.
  const to = document.querySelector<HTMLElement>('.desk[data-active="true"] [data-widget="saved"] h2') ?? document.getElementById("nav-saved");
  if (!to || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const dot = document.createElement("i");
  dot.className = "fly";
  dot.style.left = `${a.left + a.width / 2 - 6}px`;
  dot.style.top = `${a.top + a.height / 2 - 6}px`;
  document.body.append(dot);
  dot
    .animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 46}px) scale(1.5)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.3 },
      ],
      { duration: 620, easing: "cubic-bezier(.22,.7,.2,1)" },
    )
    .finished.then(() => {
      dot.remove();
      to.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], { duration: 280, easing: "ease-out" });
    })
    .catch(() => dot.remove());
}

export function SaveButton({ item }: { item: Candidate }) {
  const { has, toggle } = useSaved();
  const on = has(item.id);
  return (
    <button
      className="save"
      data-on={on}
      aria-pressed={on}
      aria-label={on ? `Remove “${item.title}” from Saved` : `Save “${item.title}”`}
      title={on ? "Saved (S to remove)" : "Save (S)"}
      onClick={(e) => {
        if (!on) fly(e.currentTarget);
        toggle(item);
      }}
    >
      <Bookmark size={16} strokeWidth={1.75} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
