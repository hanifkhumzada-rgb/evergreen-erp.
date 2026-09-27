import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { hrefWith } from "@/lib/listParams";

// Server-rendered Previous / page numbers / Next for any paginated list.
// Keeps every other URL param (search, filters, tabs).
export default function Pager({ basePath, searchParams, page, pageSize, total, param = "page", label = "Pages" }) {
  const pageCount = Math.max(1, Math.ceil((total || 0) / pageSize));
  if (pageCount <= 1) return null;
  const current = Math.min(page, pageCount);
  const href = (n) => hrefWith(basePath, searchParams, { [param]: n });
  const nums = new Set([1, pageCount, current - 1, current, current + 1].filter((n) => n >= 1 && n <= pageCount));
  const list = [...nums].sort((a, b) => a - b);
  const btn = "inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-line bg-card px-3 text-xs font-semibold";
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <nav className="no-print mt-4 flex flex-wrap items-center justify-between gap-3" aria-label={label}>
      <span className="text-xs text-slate">{from.toLocaleString()}–{to.toLocaleString()} of {Number(total).toLocaleString()}</span>
      <div className="flex items-center gap-1.5">
        {current > 1
          ? <Link href={href(current - 1)} scroll={false} className={`${btn} text-navy hover:bg-foam`} aria-label="Previous page"><ChevronLeft size={15} /> <span className="hidden sm:inline">Previous</span></Link>
          : <span className={`${btn} text-slate opacity-50`} aria-hidden="true"><ChevronLeft size={15} /></span>}
        {list.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            {i > 0 && n - list[i - 1] > 1 && <span className="text-xs text-slate">…</span>}
            {n === current
              ? <span className={`${btn} border-aqua bg-aquaSoft text-aqua`} aria-current="page">{n}</span>
              : <Link href={href(n)} scroll={false} className={`${btn} text-navy hover:bg-foam`}>{n}</Link>}
          </span>
        ))}
        {current < pageCount
          ? <Link href={href(current + 1)} scroll={false} className={`${btn} text-navy hover:bg-foam`} aria-label="Next page"><span className="hidden sm:inline">Next</span> <ChevronRight size={15} /></Link>
          : <span className={`${btn} text-slate opacity-50`} aria-hidden="true"><ChevronRight size={15} /></span>}
      </div>
    </nav>
  );
}
