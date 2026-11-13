export type Kind = "news" | "repo" | "model" | "paper" | "idea" | "lesson";

export interface Saved {
  id: string;
  kind: Kind;
  title: string;
  url?: string;
  note?: string;
  at: number;
}

export type Candidate = Omit<Saved, "at">;
