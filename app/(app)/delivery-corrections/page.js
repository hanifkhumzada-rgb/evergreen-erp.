import { PencilLine } from "lucide-react";
import { getCurrentProfile } from "@/lib/session";
import { fmtDate, pkr } from "@/lib/format";
import { Badge, Th, Td, DocumentActionBar } from "@/components/ui";
import DeliveryCorrectionForm from "@/components/DeliveryCorrectionForm";
import RecordPreview from "@/components/RecordPreview";
import ListFilterBar from "@/components/ListFilterBar";
import { TableEmptyState } from "@/components/EmptyState";
import ModulePageHeader from "@/components/ModulePageHeader";

export const dynamic = "force-dynamic";

export default async function DeliveryCorrectionsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || "").trim();
  const month = /^\d{4}-\d{2}$/.test(sp.month || "") ? sp.month : new Date().toISOString().slice(0, 7);
  const monthStart = `${month}-01`;
  const untilDate = new Date(`${monthStart}T00:00:00Z`);
  untilDate.setUTCMonth(untilDate.getUTCMonth() + 1);
  const monthUntil = untilDate.toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from : monthStart;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to : null;

  const { supabase, profile, permissions } = await getCurrentProfile();
  let deliveryQuery = supabase.from("deliveries")
    .select("id, delivery_no, delivery_date, status, amount, amount_collected, rider_remarks, customers(id,name,code,mobile), profiles!deliveries_rider_id_fkey(full_name), delivery_items(product_id,delivered_qty,returned_qty,unit_price,products(name,sku))")
    .gte("delivery_date", from)
    .in("status", ["delivered", "partially_delivered"]);
  deliveryQuery = to
    ? deliveryQuery.lte("delivery_date", to)
    : deliveryQuery.lt("delivery_date", monthUntil);
  const { data: deliveries } = await deliveryQuery.order("delivery_date", { ascending: false }).limit(1000);

  const canEdit = (permissions || []).includes("deliveries.edit") && profile?.roles?.key === "owner";
  const rows = (deliveries || []).filter((d) => {
    if (!q) return true;
    return `${d.delivery_no || ""} ${d.customers?.name || ""} ${d.customers?.code || ""} ${d.customers?.mobile || ""}`.toLowerCase().includes(q.toLowerCase());
  });

  return <div>
    <ModulePageHeader icon={PencilLine} title="Delivery Corrections" description="Safely correct a wrong bottle entry — the bottle balance and customer ledger auto-adjust." backHref="/deliveries" />

    <div className="no-print flex flex-wrap gap-2.5 mb-4 items-start">
      <ListFilterBar className="!mb-0" placeholder="Search customer, ID, phone, delivery no…" defaults={{ month }} dateFilters={[{ name: "month", label: "Month", type: "month" }, { name: "from", label: "From" }, { name: "to", label: "To" }]} />
      <div className="flex-1" />
      <DocumentActionBar
        print
        excel={{ rows: rows.map((d) => ({ Delivery: d.delivery_no, Date: d.delivery_date, Customer: d.customers?.name, "Customer ID": d.customers?.code, Rider: d.profiles?.full_name || "", Delivered: (d.delivery_items || []).reduce((a, i) => a + Number(i.delivered_qty || 0), 0), Returned: (d.delivery_items || []).reduce((a, i) => a + Number(i.returned_qty || 0), 0), Amount: Number(d.amount || 0), Collected: Number(d.amount_collected || 0), Status: d.status })), sheetName: "Deliveries", reportTitle: `Delivery Corrections ${month}` }}
        share={{ title: "Delivery Corrections" }}
      />
    </div>

    {!canEdit && <div className="mb-4 rounded-xl border border-amber/20 bg-amberSoft p-3 text-xs text-amber">Your role can view this workspace but cannot correct deliveries.</div>}

    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full min-w-[900px] text-[13px] border-collapse">
        <thead><tr className="bg-foam"><Th>Date</Th><Th>Delivery</Th><Th>Customer</Th><Th>Delivered</Th><Th>Returned</Th><Th>Amount</Th><Th>Collected</Th><Th>Rider</Th><Th>Actions</Th></tr></thead>
        <tbody>
          {rows.length === 0 && <TableEmptyState colSpan={9} title="No completed deliveries found" description="Try another customer, month, or date range." filtered />}
          {rows.map((d) => {
            const delivered = (d.delivery_items || []).reduce((sum, item) => sum + Number(item.delivered_qty || 0), 0);
            const returned = (d.delivery_items || []).reduce((sum, item) => sum + Number(item.returned_qty || 0), 0);
            const items = (d.delivery_items || []).map((item) => ({ product_id: item.product_id, product_name: item.products?.name || item.products?.sku || "Bottle", delivered_qty: item.delivered_qty, returned_qty: item.returned_qty, unit_price: item.unit_price }));
            const previewFields = [
              { label: "Delivery No", value: d.delivery_no, emphasis: true },
              { label: "Date", value: fmtDate(d.delivery_date) },
              { label: "Customer", value: d.customers?.name },
              { label: "Customer ID", value: d.customers?.code },
              { label: "Delivered", value: delivered },
              { label: "Returned", value: returned },
              { label: "Amount", value: pkr(d.amount) },
              { label: "Collected", value: pkr(d.amount_collected) },
              { label: "Delivery Boy", value: d.profiles?.full_name || "—" },
              { label: "Notes", value: d.rider_remarks || "—", fullWidth: true },
            ];
            return <tr key={d.id} className="hover:bg-foam/70"><Td>{fmtDate(d.delivery_date)}</Td><Td className="font-mono-num">{d.delivery_no}</Td><Td><div className="font-semibold">{d.customers?.name}</div><div className="text-[10px] text-slate">{d.customers?.code}</div></Td><Td><Badge text={String(delivered)} tone="aqua"/></Td><Td>{returned}</Td><Td>{pkr(d.amount)}</Td><Td>{pkr(d.amount_collected)}</Td><Td>{d.profiles?.full_name || "—"}</Td><Td><div className="flex gap-1.5"><RecordPreview iconOnly title={`${d.delivery_no} · ${d.customers?.name}`} subtitle="Read-only delivery preview" fields={previewFields} excelRows={[{ Date: d.delivery_date, Delivery: d.delivery_no, Customer: d.customers?.name, Delivered: delivered, Returned: returned, Amount: Number(d.amount || 0), Collected: Number(d.amount_collected || 0), Rider: d.profiles?.full_name || "" }]} excelTitle={d.delivery_no}/>{canEdit && <DeliveryCorrectionForm delivery={{ id: d.id, delivery_no: d.delivery_no, customer_name: d.customers?.name, delivery_items: items }}/>}</div></Td></tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}
