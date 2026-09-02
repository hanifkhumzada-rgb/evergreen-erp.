import { Bar, KPIRow, TableSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <Bar w="w-48" h="h-6" />
      <div className="mt-4 mb-5"><KPIRow count={4} /></div>
      <TableSkeleton rows={6} cols={3} />
    </div>
  );
}
