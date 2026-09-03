import { Bar, KPIRow, TableSkeleton, SkeletonShell } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonShell>
      <Bar w="w-48" h="h-6" />
      <div className="mt-4 mb-5"><KPIRow count={3} /></div>
      <TableSkeleton rows={8} cols={3} />
    </SkeletonShell>
  );
}
