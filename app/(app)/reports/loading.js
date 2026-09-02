import { Bar, TableSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <Bar w="w-32" h="h-6" />
      <div className="mt-2 mb-5"><Bar w="w-72" h="h-3.5" /></div>
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="lg:w-64 flex-shrink-0 border border-line rounded-2xl p-3 h-fit flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Bar w="w-16" h="h-2.5" />
              <Bar w="w-full" h="h-6" />
            </div>
          ))}
        </div>
        <div className="flex-1"><TableSkeleton rows={9} cols={5} /></div>
      </div>
    </div>
  );
}
