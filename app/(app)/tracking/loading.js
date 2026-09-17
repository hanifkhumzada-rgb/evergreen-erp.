import { SkeletonShell, PageHeader } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonShell>
      <PageHeader withActions={false} />
      <div className="skeleton-shimmer rounded-2xl w-full h-[420px]" />
    </SkeletonShell>
  );
}
