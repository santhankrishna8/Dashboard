import { useEffect, useState } from "react";

export function Toasts() {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    let timer = 0;
    const on = (e: Event) => {
      setMsg({ id: Date.now(), text: String((e as CustomEvent).detail) });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(null), 3200);
    };
    window.addEventListener("sd:toast", on);
    return () => {
      window.removeEventListener("sd:toast", on);
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {msg ? <p key={msg.id}>{msg.text}</p> : null}
    </div>
  );
}
