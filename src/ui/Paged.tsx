import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props<T> {
  items: T[];
  rowH: number;
  render: (item: T) => ReactNode;
  gap?: number;
  /** minimum column width; when set, rows become a responsive grid */
  minCol?: number;
  empty?: ReactNode;
  footer?: ReactNode;
}

/**
 * Nothing in this app scrolls. Paged measures its box and shows exactly as many
 * fixed-height rows as fit; the rest sit on further pages (buttons or wheel).
 */
export function Paged<T>({ items, rowH, render, gap = 0, minCol, empty, footer }: Props<T>) {
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ rows: 3, cols: 1 });
  const [page, setPage] = useState(0);
  const lastWheel = useRef(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const cols = minCol ? Math.max(1, Math.floor((el.clientWidth + gap) / (minCol + gap))) : 1;
      setFit({ rows: Math.max(1, Math.floor((el.clientHeight + gap) / (rowH + gap))), cols });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [rowH, gap, minCol]);

  const per = fit.rows * fit.cols;
  const pages = Math.max(1, Math.ceil(items.length / per));
  const p = Math.min(page, pages - 1);
  const go = (d: number) => setPage(Math.min(pages - 1, Math.max(0, p + d)));

  if (items.length === 0 && empty) return <>{empty}</>;

  return (
    <div
      className="paged"
      style={{ minHeight: rowH * 3 }}
      onWheel={(e) => {
        const now = Date.now();
        if (pages < 2 || now - lastWheel.current < 450 || Math.abs(e.deltaY) < 8) return;
        lastWheel.current = now;
        go(e.deltaY > 0 ? 1 : -1);
      }}
    >
      <div
        ref={box}
        className="paged-box"
        style={{ gridTemplateColumns: `repeat(${fit.cols}, minmax(0, 1fr))`, gridAutoRows: `minmax(${rowH}px, ${Math.round(rowH * 1.45)}px)`, gap }}
      >
        {items.slice(p * per, p * per + per).map(render)}
      </div>
      {footer}
      {pages > 1 ? (
        <div className="pager">
          <button className="icon sm" onClick={() => go(-1)} disabled={p === 0} aria-label="Previous page">
            <ChevronLeft size={15} />
          </button>
          <span aria-live="polite">{p + 1} / {pages}</span>
          <button className="icon sm" onClick={() => go(1)} disabled={p === pages - 1} aria-label="Next page">
            <ChevronRight size={15} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
