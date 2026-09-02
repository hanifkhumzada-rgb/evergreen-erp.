import { Bar } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <Bar w="w-36" h="h-6" />
      <div className="mt-2 mb-5"><Bar w="w-80" h="h-3.5" /></div>
      <div className="flex flex-col gap-2 max-w-xl">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border border-line rounded-2xl px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="animate-pulse bg-line/70 rounded-lg w-9 h-9" />
              <div className="flex flex-col gap-1.5">
                <Bar w="w-24" h="h-3.5" />
                <Bar w="w-14" h="h-3" />
              </div>
            </div>
            <div className="animate-pulse bg-line/70 rounded-lg w-20 h-8" />
          </div>
        ))}
      </div>
    </div>
  );
}
