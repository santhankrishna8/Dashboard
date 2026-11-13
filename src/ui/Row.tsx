import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { Candidate } from "../lib/types";
import { SaveButton } from "./Save";

/** Dense one-line rows; touch screens get a taller row so targets stay comfortable. */
export const ROW_H = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches ? 44 : 30;

interface Props {
  item: Candidate;
  href?: string;
  lead?: ReactNode;
  /** muted text that follows the title on the same line and is cut first */
  desc?: string | null;
  /** right-aligned facts; wrap the less important ones in <span className="opt"> */
  meta?: ReactNode;
  /** newer than the last time this device had the page open */
  fresh?: boolean;
  /** shows a hide button; the app uses it to learn what you don't want */
  onDismiss?: () => void;
}

export function Row({ item, href, lead, desc, meta, fresh, onDismiss }: Props) {
  return (
    <div className="row" data-save title={desc ? `${item.title}: ${desc}` : item.title}>
      {lead ? <div className="lead">{lead}</div> : null}
      <div className="main">
        {fresh ? (
          <i className="fresh" title="New since your last visit">
            <span className="sr">New. </span>
          </i>
        ) : null}
        {href ? (
          <a className="title" href={href} target="_blank" rel="noopener noreferrer">{item.title}</a>
        ) : (
          <span className="title">{item.title}</span>
        )}
        {desc ? <span className="desc">{desc}</span> : null}
      </div>
      {meta ? <div className="sub">{meta}</div> : null}
      {onDismiss ? (
        <button className="dismiss" onClick={onDismiss} aria-label={`Hide “${item.title}” and show fewer like it`} title="Not interested">
          <X size={14} strokeWidth={1.75} />
        </button>
      ) : null}
      <SaveButton item={item} />
    </div>
  );
}
