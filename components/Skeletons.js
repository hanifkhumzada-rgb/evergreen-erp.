// Shared building blocks for route loading.js files — pure static markup,
// no data fetching. Next.js shows these instantly on navigation while the
// real server-rendered page streams in behind them, matching the visual
// language of the KPI/Th/Td/card styles used across the real pages
// (rounded-2xl, border-line, bg-foam) so the swap-in doesn't jump around.

export function Bar({ w = "w-24", h = "h-4" }) {
  return <div className={`animate-pulse bg-line/70 rounded ${w} ${h}`} />;
}

export function PageHeader({ withActions = true }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <Bar w="w-40" h="h-6" />
      {withActions && (
        <div className="flex gap-2">
          <div className="animate-pulse bg-line/70 rounded-lg w-24 h-8" />
          <div className="animate-pulse bg-line/70 rounded-lg w-24 h-8" />
        </div>
      )}
    </div>
  );
}

export function KPIRow({ count = 4 }) {
  return (
    <div className="flex flex-wrap gap-3.5 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse bg-card border border-line rounded-2xl p-5 flex-1 min-w-[180px] h-[92px]">
          <div className="bg-line/70 rounded w-16 h-3 mb-3" />
          <div className="bg-line/70 rounded w-20 h-5" />
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
          {Array.from({ length: cols }).map((_, c) => <Bar key={c} w={c === 0 ? "w-28" : "w-16"} h="h-3.5" />)}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse border border-line rounded-2xl p-4 h-[100px]">
          <div className="bg-line/70 rounded-lg w-7.5 h-7.5 mb-3" />
          <div className="bg-line/70 rounded w-24 h-3.5" />
        </div>
      ))}
    </div>
  );
}

export function ListPageSkeleton({ kpis = 0, rows = 8, cols = 5 }) {
  return (
    <div>
      <PageHeader />
      {kpis > 0 && <KPIRow count={kpis} />}
      <TableSkeleton rows={rows} cols={cols} />
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div>
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
    </div>
  );
}
