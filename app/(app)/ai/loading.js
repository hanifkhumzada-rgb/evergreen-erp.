import { Bar, SkeletonShell } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonShell>
      <Bar w="w-40" h="h-6" />
      <div className="mt-2 mb-4"><Bar w="w-80" h="h-3.5" /></div>
      <div className="border border-line rounded-2xl p-5 max-w-2xl">
        <div className="flex flex-col gap-2.5 mb-3">
          <div className="skeleton-shimmer rounded-xl h-8 w-3/4" />
          <div className="skeleton-shimmer rounded-xl h-8 w-1/2 self-end" />
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer rounded-full h-6 w-24" />
          ))}
        </div>
        <div className="skeleton-shimmer rounded-lg h-10 w-full" />
      </div>
    </SkeletonShell>
  );
}
