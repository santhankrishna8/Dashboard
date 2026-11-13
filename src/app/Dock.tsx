import { Plus, RotateCcw } from "lucide-react";
import { WIDGETS, type WidgetId } from "./registry";

interface Props {
  unplaced: WidgetId[];
  canDrag: boolean;
  add: (id: WidgetId) => void;
  dragStart: (id: WidgetId) => void;
  dragEnd: () => void;
  reset: () => void;
  done: () => void;
}

export function Dock({ unplaced, canDrag, add, dragStart, dragEnd, reset, done }: Props) {
  return (
    <aside className="dock" aria-label="Customise layout">
      <p className="dock-help">
        {canDrag
          ? "Drag a card to move it, drop it between columns to start a new column, and drag the gaps to resize."
          : "Remove a card with ×, then add it back from here. Drag and resize work on a larger screen."}
      </p>
      <div className="dock-chips">
        {unplaced.length === 0 ? (
          <span className="muted">Every widget is on a desk. Remove one with × and it waits here.</span>
        ) : (
          unplaced.map((id) => (
            <button
              key={id}
              className="btn"
              draggable={canDrag}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", id);
                dragStart(id);
              }}
              onDragEnd={dragEnd}
              onClick={() => add(id)}
              title={`Add ${WIDGETS[id].name} to this desk`}
            >
              <Plus size={14} /> {WIDGETS[id].name}
            </button>
          ))
        )}
      </div>
      <button className="btn ghost" onClick={reset}>
        <RotateCcw size={14} /> Reset layout
      </button>
      <button className="btn primary" onClick={done}>
        Done
      </button>
    </aside>
  );
}
