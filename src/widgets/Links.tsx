import { useState, type FormEvent } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { Card } from "../ui/Card";
import { Paged } from "../ui/Paged";
import { host } from "../lib/fmt";
import { useSynced } from "../lib/sync";

interface Link {
  id: string;
  name: string;
  url: string;
}

const SEED: Link[] = [
  { id: "gh", name: "GitHub", url: "https://github.com" },
  { id: "hf", name: "Hugging Face", url: "https://huggingface.co" },
  { id: "vercel", name: "Vercel", url: "https://vercel.com/dashboard" },
  { id: "firebase", name: "Firebase console", url: "https://console.firebase.google.com" },
  { id: "mdn", name: "MDN", url: "https://developer.mozilla.org" },
  { id: "hn", name: "Hacker News", url: "https://news.ycombinator.com" },
];

/** Accepts "example.com" or a full URL; returns null unless the result is http(s). */
const normalise = (input: string): string | null => {
  const v = input.trim();
  if (!v) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
};

export function LinksWidget() {
  const [links, save] = useSynced<Link[]>("sd:links", SEED);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const href = normalise(url);
    if (!href) return setErr("Enter a web address such as github.com or https://example.com/page.");
    save([...links, { id: crypto.randomUUID(), name: name.trim() || host(href), url: href }]);
    setName("");
    setUrl("");
    setErr("");
    setAdding(false);
  };

  return (
    <Card
      title="Favourite links"
      meta={`${links.length}`}
      actions={
        <>
          <button className="icon" aria-pressed={editing} onClick={() => setEditing((v) => !v)} aria-label={editing ? "Done editing links" : "Edit links"} title={editing ? "Done" : "Edit"}>
            <Pencil size={15} />
          </button>
          <button className="icon" aria-pressed={adding} onClick={() => { setAdding((v) => !v); setErr(""); }} aria-label="Add a link" title="Add a link">
            <Plus size={16} />
          </button>
        </>
      }
    >
      {adding ? (
        <form className="link-form" onSubmit={submit} noValidate>
          <input value={url} autoFocus onChange={(e) => setUrl(e.target.value)} placeholder="Address, e.g. github.com" aria-label="Link address" aria-invalid={!!err} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" aria-label="Link name" />
          <button className="btn primary" type="submit">Add</button>
          {err ? <p className="form-err" role="alert">{err}</p> : null}
        </form>
      ) : null}
      <Paged
        items={links}
        rowH={36}
        gap={4}
        minCol={128}
        empty={<p className="stale">No links yet. Use + to add your first.</p>}
        render={(l) => (
          <div className="tile-wrap" key={l.id}>
            <a className="tile" href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}>
              <b aria-hidden="true">{l.name.slice(0, 1).toUpperCase()}</b>
              <span>{l.name}</span>
            </a>
            {editing ? (
              <button className="icon sm del" onClick={() => save(links.filter((x) => x.id !== l.id))} aria-label={`Remove ${l.name}`}>
                <X size={14} />
              </button>
            ) : null}
          </div>
        )}
      />
    </Card>
  );
}
