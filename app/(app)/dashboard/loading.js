import { Bar, KPIRow, SkeletonShell } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonShell>
      <Bar w="w-72" h="h-7" />
      <div className="mt-2 mb-5"><Bar w="w-48" h="h-3.5" /></div>

      <div className="grid grid-cols-2 gap-2.5 mb-6 max-w-md">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-line rounded-xl h-[84px] flex flex-col items-center justify-center gap-2">
            <div className="skeleton-shimmer rounded-full w-9 h-9" />
            <div className="skeleton-shimmer rounded w-16 h-2.5" />
          </div>
        ))}
      </div>

      <KPIRow count={6} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 mb-4">
        <div className="skeleton-shimmer border border-line rounded-2xl h-[260px]" />
        <div className="skeleton-shimmer border border-line rounded-2xl h-[260px]" />
      </div>

      <div className="skeleton-shimmer border border-line rounded-2xl h-[140px]" />
    </SkeletonShell>
  );
}
