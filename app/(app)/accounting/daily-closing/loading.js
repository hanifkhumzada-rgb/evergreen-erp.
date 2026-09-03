import { Bar, TableSkeleton, SkeletonShell } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonShell>
      <Bar w="w-48" h="h-6" />
      <div className="mt-4 mb-6 skeleton-shimmer border border-line rounded-2xl h-[220px]" />
      <TableSkeleton rows={5} cols={4} />
    </SkeletonShell>
  );
}
