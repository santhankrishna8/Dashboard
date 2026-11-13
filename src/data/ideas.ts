export interface Idea {
  id: string;
  title: string;
  pitch: string;
  stack: string;
  effort: "a day" | "a weekend" | "a week";
}

/** Offline fallback. /api/ideas (OpenAI, ranked by Jev against your saves) replaces this when configured. */
export const IDEAS: Idea[] = [
  { id: "pr-reviewer", title: "A PR reviewer for your own repos", pitch: "A GitHub Action that comments on a diff only for files you tag, with a short rubric you control. Useful because you tune the rules instead of fighting a generic bot.", stack: "GitHub Actions · TypeScript · any LLM API", effort: "a weekend" },
  { id: "prompt-regress", title: "Prompt regression suite", pitch: "YAML test cases plus a runner that diffs outputs between two prompt versions and flags what changed. Teaches you evals by making you write them.", stack: "Node · Zod · YAML", effort: "a day" },
  { id: "local-bookmarks", title: "Local-first bookmark brain", pitch: "Save pages, embed them in the browser and search by meaning, with nothing leaving your machine.", stack: "transformers.js · IndexedDB · React", effort: "a week" },
  { id: "standup", title: "Standup from commits and calendar", pitch: "Reads yesterday's commits and meetings and drafts three honest lines. You edit; it never posts for you.", stack: "git · Google Calendar API · CLI", effort: "a weekend" },
  { id: "cost-lens", title: "Cost lens for LLM calls", pitch: "A thin proxy that logs tokens and cost per feature, then shows which prompt is quietly eating the budget.", stack: "Hono · SQLite · Recharts", effort: "a week" },
  { id: "voice-ticket", title: "Voice note to structured ticket", pitch: "Record a rambling thought, get a titled issue with steps and acceptance criteria validated against a schema.", stack: "Whisper · Zod · GitHub Issues API", effort: "a weekend" },
  { id: "flaky-tests", title: "Flaky test detective", pitch: "Parse CI logs across runs, cluster failures by stack trace and list the tests that fail without a code change.", stack: "GitHub API · Python · embeddings", effort: "a week" },
  { id: "schema-forms", title: "Schema to form generator", pitch: "Point it at a Zod schema and get an accessible React form with inline validation and no hand-written fields.", stack: "React · Zod · React Hook Form", effort: "a weekend" },
  { id: "reading-queue", title: "Reading queue triage", pitch: "Takes your saved links, estimates reading time and ranks them by how closely they match what you finished before.", stack: "Firebase · Readability · embeddings", effort: "a day" },
  { id: "doc-drift", title: "Doc drift checker", pitch: "Flags README claims, flags and examples that no longer match the code, and opens a checklist instead of a rewrite.", stack: "tree-sitter · TypeScript", effort: "a week" },
  { id: "tiny-agent", title: "A one-tool agent, no framework", pitch: "Write the loop yourself: call the model, run the one tool it asks for, feed the result back, stop. Thirty lines that make every agent framework legible.", stack: "TypeScript · any LLM API", effort: "a day" },
  { id: "changelog", title: "Changelog historian", pitch: "Summarise a repo's last 90 days into release notes grouped by what users would notice, linking each line to its commit.", stack: "git log · CLI · Markdown", effort: "a weekend" },
];
