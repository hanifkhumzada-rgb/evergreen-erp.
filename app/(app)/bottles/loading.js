import { Bar, KPIRow, TableSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <Bar w="w-40" h="h-6" />
      <div className="mt-2 mb-6"><Bar w="w-64" h="h-3.5" /></div>
      <KPIRow count={2} />
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}
