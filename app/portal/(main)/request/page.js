import { requirePortalCustomer } from "@/lib/portal/session";
import WaterRequestForm from "@/components/portal/WaterRequestForm";

export const dynamic = "force-dynamic";

export default async function PortalRequestPage() {
  const { supabase, customerId } = await requirePortalCustomer();
  const [{ data: customer }, { data: requests }] = await Promise.all([
    supabase.from("customers").select("address, area").eq("id", customerId).maybeSingle(),
    supabase.from("customer_issues").select("id, description, status, created_at, resolution_note").eq("customer_id", customerId).eq("issue_type", "Water Delivery Request").order("created_at", { ascending: false }).limit(10),
  ]);
  return <div className="flex flex-col gap-4">
    <div><h1 className="font-display text-xl font-semibold">Request Water Delivery</h1><p className="mt-1 text-xs text-slate">Send a 19L bottle request in a few seconds.</p></div>
    <WaterRequestForm defaultAddress={[customer?.address, customer?.area].filter(Boolean).join(", ")} />
    <section><h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate">Recent Requests</h2><div className="space-y-2">
      {!requests?.length && <div className="rounded-2xl border border-line bg-card p-5 text-center text-xs text-slate">No delivery requests yet.</div>}
      {(requests || []).map((request) => <article key={request.id} className="rounded-2xl border border-line bg-card p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold">19L Water Request</span><span className="rounded-full bg-aquaSoft px-2.5 py-1 text-[10px] font-bold capitalize text-aqua">{request.status.replaceAll("_", " ")}</span></div><p className="mt-2 whitespace-pre-line text-[11px] text-slate">{request.description.split("\nRequest key:")[0]}</p>{request.resolution_note && <p className="mt-2 border-t border-line pt-2 text-xs">{request.resolution_note}</p>}</article>)}
    </div></section>
  </div>;
}
