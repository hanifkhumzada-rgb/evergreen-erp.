import { SkeletonShell, PageHeader, CardGridSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <SkeletonShell>
      <PageHeader withActions={false} />
      <CardGridSkeleton count={3} />
    </SkeletonShell>
  );
}
