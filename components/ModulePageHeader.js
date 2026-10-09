import { ChevronLeft } from "lucide-react";
import Link from "next/link";

// Canonical heading for ERP modules. Actions remain real links/forms supplied
// by the page; this component only standardizes layout and responsive wrapping.
export default function ModulePageHeader({ title, description, eyebrow = "Evergreen Water ERP", icon: Icon, backHref, actions, className = "" }) {
  return (
    <header className={`no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        {backHref ? (
          <Link href={backHref} aria-label="Go back" className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-card text-slate hover:bg-aquaSoft hover:text-aqua">
            <ChevronLeft size={18} />
          </Link>
        ) : Icon ? (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-aquaSoft text-aqua"><Icon size={19} /></span>
        ) : null}
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.15em] text-aqua">{eyebrow}</p>
          <h1 className="font-display text-2xl font-semibold leading-tight text-ink">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </header>
  );
}
