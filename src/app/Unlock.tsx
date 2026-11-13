import { useEffect, useRef, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";

/** One passcode, entered once per device. Autocomplete is on, so your password manager can fill it next time. */
export function Unlock({ open, onClose, onUnlock }: { open: boolean; onClose: () => void; onUnlock: (code: string) => Promise<string | null> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setCode("");
      setErr("");
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code || busy) return;
    setBusy(true);
    const problem = await onUnlock(code);
    setBusy(false);
    if (problem) setErr(problem);
  };

  return (
    <dialog ref={ref} className="unlock" aria-labelledby="unlock-h" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <form onSubmit={(e) => void submit(e)}>
        <h2 id="unlock-h"><KeyRound size={17} aria-hidden="true" /> Unlock integrations</h2>
        <p className="muted">Enter the passcode you set as DASHBOARD_PASSCODE. It turns on the AI, GitHub and Vercel cards on this device, and nothing else is stored.</p>
        <label className="sr" htmlFor="unlock-code">Passcode</label>
        <input id="unlock-code" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={!!err} autoFocus />
        {err ? <p className="form-err" role="alert">{err}</p> : null}
        <div className="unlock-actions">
          <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn primary" type="submit" disabled={!code || busy}>{busy ? "Checking" : "Unlock"}</button>
        </div>
      </form>
    </dialog>
  );
}
