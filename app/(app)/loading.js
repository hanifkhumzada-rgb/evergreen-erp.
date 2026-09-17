export default function AppLoading() {
  return (
    <div role="status" aria-label="Loading workspace">
      <div className="mb-5 overflow-hidden rounded-3xl border border-aqua/15 bg-gradient-to-r from-navy to-[#087C69] p-5 sm:p-7">
        <div className="skeleton-shimmer mb-3 h-3 w-40 rounded-full opacity-40" />
        <div className="skeleton-shimmer mb-2 h-8 w-64 max-w-[75%] rounded-xl opacity-50" />
        <div className="skeleton-shimmer h-4 w-48 max-w-[60%] rounded-lg opacity-35" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="premium-kpi rounded-2xl border border-line bg-card p-4">
            <div className="skeleton-shimmer mb-4 h-3 w-20 rounded-full" />
            <div className="skeleton-shimmer h-7 w-28 max-w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="skeleton-shimmer mb-5 h-5 w-44 rounded-lg" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((item) => <div key={item} className="skeleton-shimmer h-11 rounded-xl" />)}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
