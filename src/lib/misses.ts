import { getSynced, setSynced } from "./sync";

export interface Miss {
  id: string;
  title: string;
  q: string;
  options: [string, string, string];
  answer: 0 | 1 | 2;
  why: string;
  /** when it is next due, and how many correct answers in a row it has earned */
  due: number;
  step: number;
}

export const DAY = 86_400_000;
/** Days until the next review after each consecutive correct answer. A fifth one retires the question. */
export const INTERVALS = [1, 3, 7, 14, 30];
const KEY = "sd:misses";

export const readMisses = (): Miss[] => getSynced<Miss[]>(KEY, []);

/** A wrong quiz answer comes back tomorrow, then at growing gaps while you keep getting it right. */
export function recordMiss(m: Omit<Miss, "due" | "step">) {
  const rest = readMisses().filter((x) => x.id !== m.id);
  setSynced(KEY, [...rest, { ...m, step: 0, due: Date.now() + DAY }]);
}

export function settle(id: string, correct: boolean) {
  const list = readMisses();
  const hit = list.find((x) => x.id === id);
  if (!hit) return;
  const rest = list.filter((x) => x.id !== id);
  if (!correct) return setSynced(KEY, [...rest, { ...hit, step: 0, due: Date.now() + DAY }]);
  const step = hit.step + 1;
  setSynced(KEY, step >= INTERVALS.length ? rest : [...rest, { ...hit, step, due: Date.now() + (INTERVALS[step] ?? 30) * DAY }]);
}
