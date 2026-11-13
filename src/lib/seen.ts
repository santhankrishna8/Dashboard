import { useEffect, useState } from "react";

/**
 * "New since you last looked": returns the time this device last had the page open, then keeps that marker
 * fresh when the tab is hidden or closed. The very first visit marks nothing as new.
 */
export function useSince(key: string): number {
  const [since] = useState(() => {
    try {
      const v = localStorage.getItem(`sd:seen:${key}`);
      return v ? Number(v) : Date.now();
    } catch {
      return Date.now();
    }
  });
  useEffect(() => {
    const stamp = () => {
      try {
        localStorage.setItem(`sd:seen:${key}`, String(Date.now()));
      } catch {
        /* ignore */
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") stamp();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", stamp);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", stamp);
    };
  }, [key]);
  return since;
}
