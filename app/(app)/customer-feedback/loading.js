import { ListPageSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return <ListPageSkeleton kpis={3} rows={8} cols={5} />;
}
