export default function AppLoading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading workspace">
      <div className="mb-5 h-8 w-48 rounded-xl bg-foam" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 rounded-2xl border border-line bg-card" />)}
      </div>
      <div className="h-72 rounded-2xl border border-line bg-card" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
