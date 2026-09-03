import { Bar, SkeletonShell } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonShell>
      <Bar w="w-28" h="h-4" />
      <div className="border border-line rounded-2xl p-8 max-w-lg mt-4">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <div className="skeleton-shimmer rounded-lg w-8 h-8" />
            <Bar w="w-40" h="h-4" />
          </div>
          <div className="skeleton-shimmer rounded-full w-20 h-6" />
        </div>
        <div className="flex justify-between mb-4">
          <div className="flex flex-col gap-1.5">
            <Bar w="w-16" h="h-3" />
            <Bar w="w-28" h="h-3.5" />
            <Bar w="w-32" h="h-3.5" />
            <Bar w="w-24" h="h-3.5" />
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <Bar w="w-24" h="h-3" />
            <Bar w="w-20" h="h-3.5" />
          </div>
        </div>
        <div className="border-t border-line pt-4 flex flex-col gap-2">
          <Bar w="w-full" h="h-3.5" />
          <Bar w="w-full" h="h-3.5" />
          <Bar w="w-2/3" h="h-3.5" />
        </div>
      </div>
    </SkeletonShell>
  );
}
