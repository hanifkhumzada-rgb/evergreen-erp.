export default function PortalLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading portal page">
      <div className="h-7 w-44 rounded-lg bg-line" />
      <div className="h-24 rounded-2xl bg-card border border-line" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 rounded-2xl bg-card border border-line" />
        <div className="h-28 rounded-2xl bg-card border border-line" />
      </div>
      <div className="h-20 rounded-2xl bg-card border border-line" />
      <div className="h-20 rounded-2xl bg-card border border-line" />
    </div>
  );
}
