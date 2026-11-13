import { useId } from "react";

/** Trend line with a soft area under it. Colour follows currentColor; direction is also in the numbers beside it. */
export function Spark({ values, w = 72, h = 24 }: { values: number[]; w?: number; h?: number }) {
  const id = useId();
  const v = values.filter((n) => Number.isFinite(n));
  if (v.length < 2) return <svg width={w} height={h} aria-hidden="true" />;
  const min = Math.min(...v);
  const span = Math.max(...v) - min || 1;
  const pad = 3;
  const xy = v.map((n, i) => [(i / (v.length - 1)) * (w - pad * 2) + pad, h - pad - ((n - min) / span) * (h - pad * 2)] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = xy[xy.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="spark">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.26" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pad},${h} ${line} ${w - pad},${h}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {last ? <circle cx={last[0]} cy={last[1]} r="2.4" fill="currentColor" /> : null}
    </svg>
  );
}
