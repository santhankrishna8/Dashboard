export const ago = (t: number): string => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

export const compact = (n: number): string =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const money = (n: number, cur = "USD"): string =>
  new Intl.NumberFormat("en", { style: "currency", currency: cur, maximumFractionDigits: n < 10 ? 2 : 0 }).format(n);

export const pct = (n: number): string => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;

export const host = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
