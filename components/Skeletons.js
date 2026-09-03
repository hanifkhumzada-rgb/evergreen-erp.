import { Droplet } from "lucide-react";

// Shared building blocks for route loading.js files — pure static markup,
// no data fetching. Next.js shows these instantly on navigation while the
// real server-rendered page streams in behind them, matching the visual
// language of the KPI/Th/Td/card styles used across the real pages
// (rounded-2xl, border-line, bg-foam) so the swap-in doesn't jump around.
//
// Every shape here uses the `.skeleton-shimmer` class (globals.css) — a
// left-to-right highlight sweep through the app's own line/aquaSoft
// colors — instead of a flat gray `animate-pulse`, so a slow load still
// feels on-brand rather than like a generic placeholder.

// A few width variants so table/list rows don't look robotically
// identical — cycles deterministically per row+col, no client JS needed.
const WIDTHS = ["w-24", "w-16", "w-28", "w-14", "w-20", "w-32", "w-12"];
function varyWidth(seed) { return WIDTHS[seed % WIDTHS.length]; }

export function Bar({ w = "w-24", h = "h-4" }) {
  return <div className={`skeleton-shimmer rounded ${w} ${h}`} />;
}

// The small teal droplet badge used as the brand mark everywhere real
// (login header, invoice PDF) — reused here, gently pulsing, so a slow
// loading screen still reads as "the app is working," not blank.
export function BrandMark() {
  return (
    <div className="absolute top-0 right-0 w-8 h-8 rounded-xl bg-aqua/90 flex items-center justify-center skeleton-mark-pulse" aria-hidden="true">
      <Droplet size={15} className="text-white" />
    </div>
  );
}

// Wraps a loading.js's content with the brand mark positioned top-right —
// used by every skeleton below so it never has to be added file-by-file.
export function SkeletonShell({ children }) {
  return (
    <div className="relative pr-10">
      {children}
      <BrandMark />
    </div>
  );
}

function IconDot({ size = "w-9 h-9" }) {
  return <div className={`skeleton-shimmer rounded-full ${size} flex-shrink-0`} />;
}

export function PageHeader({ withActions = true }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-2.5">
        <IconDot size="w-7 h-7" />
        <Bar w="w-40" h="h-6" />
      </div>
      {withActions && (
        <div className="flex gap-2">
          <div className="skeleton-shimmer rounded-lg w-24 h-8" />
          <div className="skeleton-shimmer rounded-lg w-20 h-8" />
        </div>
      )}
    </div>
  );
}

export function KPIRow({ count = 4 }) {
  return (
    <div className="flex flex-wrap gap-3.5 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-line rounded-2xl p-5 flex-1 min-w-[180px] h-[92px] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="skeleton-shimmer rounded w-16 h-3" />
            <IconDot size="w-6 h-6" />
          </div>
          <div className={`skeleton-shimmer rounded h-5 ${varyWidth(i)}`} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }) {
  return (
    <div className="overflow-hidden border border-line rounded-2xl">
      <div className="bg-foam px-3.5 py-2.5 flex gap-6">
        {Array.from({ length: cols }).map((_, i) => <Bar key={i} w="w-16" h="h-3" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-3.5 py-3 flex gap-6 border-t border-line">
          {Array.from({ length: cols }).map((_, c) => (
            <Bar key={c} w={c === 0 ? "w-28" : varyWidth(r * cols + c)} h="h-3.5" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-line rounded-2xl p-4 h-[100px] flex flex-col gap-3">
          <IconDot size="w-7.5 h-7.5" />
          <div className={`skeleton-shimmer rounded h-3.5 ${varyWidth(i)}`} />
        </div>
      ))}
    </div>
  );
}

export function ListPageSkeleton({ kpis = 0, rows = 8, cols = 5 }) {
  return (
    <SkeletonShell>
      <PageHeader />
      {kpis > 0 && <KPIRow count={kpis} />}
      <TableSkeleton rows={rows} cols={cols} />
    </SkeletonShell>
  );
}

export function DetailPageSkeleton() {
  return (
    <SkeletonShell>
      <Bar w="w-32" h="h-4" />
      <div className="mt-4 mb-5">
        <Bar w="w-56" h="h-7" />
        <div className="mt-2"><Bar w="w-72" h="h-3.5" /></div>
      </div>
      <KPIRow count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TableSkeleton rows={5} cols={3} />
        <TableSkeleton rows={5} cols={3} />
      </div>
    </SkeletonShell>
  );
}
