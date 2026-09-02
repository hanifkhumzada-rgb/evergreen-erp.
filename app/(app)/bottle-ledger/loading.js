import { Bar, KPIRow, TableSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <Bar w="w-40" h="h-6" />
      <div className="mt-2 mb-5"><Bar w="w-64" h="h-3.5" /></div>
      <KPIRow count={4} />
      <div className="mb-6"><TableSkeleton rows={4} cols={7} /></div>
      <div className="mb-6"><TableSkeleton rows={4} cols={6} /></div>
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
