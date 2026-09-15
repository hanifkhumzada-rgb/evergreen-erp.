import { ListPageSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return <ListPageSkeleton kpis={4} rows={9} cols={5} />;
}
