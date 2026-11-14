import type { ComponentType } from "react";
import { NewsWidget } from "../widgets/News";
import { ReposWidget } from "../widgets/Discover";
import { ClocksWidget } from "../widgets/Clocks";
import { WeatherWidget } from "../widgets/Weather";
import { CurrencyWidget } from "../widgets/Currency";
import { RadarWidget } from "../widgets/Radar";
import { CricketWidget } from "../widgets/Cricket";
import { StatusWidget } from "../widgets/Status";
import { LessonWidget, IdeasWidget } from "../widgets/Learn";
import { FocusWidget } from "../widgets/Focus";
import { SavedWidget } from "../widgets/SavedVault";
import { TasksWidget } from "../widgets/Tasks";
import { DeadlinesWidget } from "../widgets/Deadlines";
import { LinksWidget } from "../widgets/Links";
import { BriefWidget } from "../widgets/Brief";
import { PadWidget } from "../widgets/Pad";
import { SpendWidget } from "../widgets/Spend";
import { GithubWidget } from "../widgets/Github";
import { VercelWidget } from "../widgets/Vercel";
import { ReviewWidget } from "../widgets/Review";

export const WIDGETS = {
  tasks: { name: "Tasks", Comp: TasksWidget },
  deadlines: { name: "Deadlines", Comp: DeadlinesWidget },
  brief: { name: "Today's brief", Comp: BriefWidget },
  github: { name: "Your GitHub", Comp: GithubWidget },
  vercel: { name: "Vercel projects", Comp: VercelWidget },
  review: { name: "Review your misses", Comp: ReviewWidget },
  pad: { name: "Scratchpad", Comp: PadWidget },
  spend: { name: "Token spend", Comp: SpendWidget },
  focus: { name: "Focus timer", Comp: FocusWidget },
  news: { name: "AI news", Comp: NewsWidget },
  lesson: { name: "Learn one thing", Comp: LessonWidget },
  ideas: { name: "Try building this", Comp: IdeasWidget },
  repos: { name: "Repos worth a look", Comp: ReposWidget },
  saved: { name: "Saved", Comp: SavedWidget },
  radar: { name: "AI model radar", Comp: RadarWidget },
  cricket: { name: "Cricket", Comp: CricketWidget },
  status: { name: "Service status", Comp: StatusWidget },
  currency: { name: "Currencies", Comp: CurrencyWidget },
  weather: { name: "Weather and air", Comp: WeatherWidget },
  clocks: { name: "World clocks", Comp: ClocksWidget },
  links: { name: "Favourite links", Comp: LinksWidget },
} satisfies Record<string, { name: string; Comp: ComponentType }>;

export type WidgetId = keyof typeof WIDGETS;
export const isWidgetId = (s: unknown): s is WidgetId => typeof s === "string" && s in WIDGETS;

/** A card and its share of the column's height. */
export interface CardRef {
  id: WidgetId;
  h: number;
}
/** A column and its share of the desk's width. Columns and cards always stretch to fill, so a desk has no holes. */
export interface Col {
  w: number;
  cards: CardRef[];
}

const col = (w: number, ...cards: [WidgetId, number][]): Col => ({ w, cards: cards.map(([id, h]) => ({ id, h })) });

export const DESKS = [
  {
    id: "today",
    name: "Today",
    cols: [
      col(4.5, ["tasks", 4.5], ["brief", 4.5], ["pad", 3]),
      col(3.5, ["github", 4], ["vercel", 4], ["review", 4]),
      col(4, ["deadlines", 4], ["spend", 3.5], ["focus", 4.5]),
    ],
  },
  {
    id: "build",
    name: "Build",
    cols: [
      col(4, ["news", 12]),
      col(3.75, ["lesson", 8], ["ideas", 4]),
      col(3.25, ["repos", 6], ["saved", 6]),
    ],
  },
  {
    id: "pulse",
    name: "Pulse",
    cols: [
      col(3.5, ["radar", 7], ["currency", 5]),
      col(3.5, ["cricket", 12]),
      col(2.5, ["weather", 8], ["status", 4]),
      col(2.5, ["clocks", 6.5], ["links", 5.5]),
    ],
  },
] as const;

export const MAX_COLS = 6;
