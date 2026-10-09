import { Inbox, SearchX } from "lucide-react";

export default function EmptyState({ title = "No records found", description, filtered = false, action, compact = false }) {
  const Icon = filtered ? SearchX : Inbox;
  return (
    <div className={`mx-auto flex max-w-md flex-col items-center px-5 text-center ${compact ? "py-6" : "py-10"}`}>
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-aquaSoft text-aqua"><Icon size={20} /></span>
      <strong className="text-sm text-ink">{title}</strong>
      {description ? <p className="mt-1 text-xs leading-relaxed text-slate">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function TableEmptyState({ colSpan, title = "No records found", description, filtered = false, compact = false }) {
  return <tr><td colSpan={colSpan}><EmptyState title={title} description={description} filtered={filtered} compact={compact} /></td></tr>;
}
