import { useEffect, useRef, useState } from "react";

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A number that counts to its value with an exponential ease-out, then to each new value. Tabular digits keep it from jittering. */
export function Count({ value, decimals = 0, from = 0, format }: { value: number; decimals?: number; from?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(calm() ? value : from);
  const at = useRef(shown);

  useEffect(() => {
    if (calm()) {
      setShown(value);
      at.current = value;
      return;
    }
    const a = at.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 4));
      at.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{format ? format(Math.round(shown)) : shown.toFixed(decimals)}</>;
}
