import { Bar } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <div className="mb-4"><Bar w="w-32" h="h-6" /></div>
      <div className="flex flex-col gap-5">
        <div className="border border-line rounded-2xl p-5 max-w-xl flex flex-col gap-3">
          <Bar w="w-40" h="h-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Bar w="w-56" h="h-3.5" />
              <div className="animate-pulse bg-line/70 rounded-full w-10 h-5" />
            </div>
          ))}
        </div>
        <div className="border border-line rounded-2xl p-5 max-w-xl flex flex-col gap-2">
          <Bar w="w-48" h="h-4" />
          <Bar w="w-full" h="h-3" />
          <Bar w="w-full" h="h-3" />
          <Bar w="w-2/3" h="h-3" />
        </div>
      </div>
    </div>
  );
}
