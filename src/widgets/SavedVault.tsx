import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, Empty } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { ROW_H } from "../ui/Row";
import { useSaved, hasFirebase } from "../lib/store";
import { ago } from "../lib/fmt";
import type { Kind } from "../lib/types";

const LABEL: Record<Kind, string> = { news: "News", repo: "Repos", model: "Models", paper: "Papers", idea: "Ideas", lesson: "Lessons" };

export function SavedWidget() {
  const { items, remove, mode, user, signIn } = useSaved();
  const [kind, setKind] = useState<Kind | "all">("all");
  const kinds = useMemo(() => [...new Set(items.map((i) => i.kind))], [items]);
  const shown = kind === "all" || !kinds.includes(kind) ? items : items.filter((i) => i.kind === kind);

  return (
    <Card
      title="Saved"
      meta={`${items.length} item${items.length === 1 ? "" : "s"} · ${mode === "cloud" ? `synced to Firebase as ${user?.displayName ?? user?.email ?? "you"}` : "stored in this browser"}`}
      actions={
        !user && hasFirebase ? <button className="btn" onClick={signIn}>Sign in to sync</button> : undefined
      }
    >
      {items.length > 0 ? (
        <div className="chips" role="group" aria-label="Filter saved items">
          {(["all", ...kinds] as const).map((k) => (
            <button key={k} aria-pressed={k === kind} onClick={() => setKind(k)}>{k === "all" ? "All" : LABEL[k]}</button>
          ))}
        </div>
      ) : null}
      <Paged
        items={shown}
        rowH={ROW_H}
        gap={0}
        minCol={340}
        empty={<Empty title="Nothing saved yet" hint="Hover any story, repo or idea and press S, or click its bookmark." />}
        footer={items.length > 0 && items.length < 6 ? <p className="stale">Hover any item and press S to save it here.</p> : undefined}
        render={(s) => (
          <div className="row" key={s.id} title={s.note ? `${s.title}: ${s.note}` : s.title}>
            <div className="lead"><span className="tag">{LABEL[s.kind]}</span></div>
            <div className="main">
              {s.url ? (
                <a className="title" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
              ) : (
                <span className="title">{s.title}</span>
              )}
              {s.note ? <span className="desc">{s.note}</span> : null}
            </div>
            <div className="sub"><span className="opt">{ago(s.at)}</span></div>
            <button className="save" onClick={() => remove(s.id)} aria-label={`Remove “${s.title}” from Saved`} title="Remove">
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
          </div>
        )}
      />
    </Card>
  );
}
