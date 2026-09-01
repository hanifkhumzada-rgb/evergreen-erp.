import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import MarkDeliveredButton from "@/components/MarkDeliveredButton";
import DeliveryStatusButton from "@/components/DeliveryStatusButton";
import BulkImportButton from "@/components/BulkImportButton";
import { bulkImportDeliveries } from "@/app/actions";
import { Phone, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";
function todayISO() { return new Date().toISOString().slice(0, 10); }
const STATUS_TONE = (s) => (s === "delivered" ? "green" : s === "cancelled" || s === "missed" ? "coral" : "amber");

export default async function DeliveriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*, roles(key)").eq("id", user.id).single();

  if (profile?.roles?.key === "rider") {
    const { data: deliveries } = await supabase.from("deliveries")
      .select("*, customers(*), delivery_items(expected_qty)")
      .eq("rider_id", user.id).eq("delivery_date", todayISO());

    return (
      <div>
        <h2 className="font-display text-2xl font-semibold mb-4">Today&apos;s Route</h2>
        <div className="flex flex-col gap-3">
          {(deliveries || []).length === 0 && <p className="text-sm text-slate">No deliveries assigned for today.</p>}
          {(deliveries || []).map((d) => {
            const qty = (d.delivery_items || []).reduce((a, i) => a + Number(i.expected_qty), 0);
            return (
              <div key={d.id} className="border border-line rounded-2xl p-4">
                <div className="flex justify-between"><strong>{d.customers?.name}</strong><Badge text={d.status} tone={STATUS_TONE(d.status)} /></div>
                <p className="text-xs text-slate my-1">{d.customers?.address}</p>
                <p className="text-sm">Qty: <strong>{qty}</strong> · Empty expected: <strong>{qty}</strong></p>
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  <a href={`tel:${d.customers?.mobile}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold"><Phone size={14} /> Call</a>
                  {d.customers?.whatsapp_number && <a href={`https://wa.me/${d.customers.whatsapp_number.replace(/^0/, "92")}`} target="_blank" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold"><MessageCircle size={14} /> WhatsApp</a>}
                  {d.status !== "delivered" && (
                    <>
                      <MarkDeliveredButton deliveryId={d.id} emptyExpected={qty} />
                      <DeliveryStatusButton deliveryId={d.id} status="missed" label="Failed" tone="coral" />
                      <DeliveryStatusButton deliveryId={d.id} status="rescheduled" label="Reschedule" tone="amber" />
                      <DeliveryStatusButton deliveryId={d.id} status="cancelled" label="Cancel" tone="coral" />
                    </>
                  )}
                </div>
                {d.rider_remarks && <p className="text-xs text-slate mt-2 italic">Note: {d.rider_remarks}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const { data: deliveries } = await supabase.from("deliveries")
    .select("*, customers(name), profiles!deliveries_rider_id_fkey(full_name), delivery_items(expected_qty)")
    .order("delivery_date", { ascending: false }).limit(200);
  const qtyOf = (d) => (d.delivery_items || []).reduce((a, i) => a + Number(i.expected_qty), 0);
  const exportRows = (deliveries || []).map((d) => ({ Date: d.delivery_date, Customer: d.customers?.name, Qty: qtyOf(d), DeliveryBoy: d.profiles?.full_name, Status: d.status, CashCollected: d.amount_collected }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Deliveries</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Phone (or Name), Qty, CashCollected, Date"
          action={bulkImportDeliveries}
          sampleRow={{ Phone: "03001234567", Name: "Ali Traders", Qty: 5, CashCollected: 600, Date: "2026-08-31" }}
          previewType="deliveries"
        />
        <ExportExcelButton rows={exportRows} filename="evergreen-deliveries.xlsx" sheetName="Deliveries" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Delivery Boy</Th><Th>Status</Th><Th>Cash Collected</Th><Th>Notes</Th></tr></thead>
          <tbody>
            {(deliveries || []).length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate">No deliveries yet.</td></tr>}
            {(deliveries || []).map((d) => (
              <tr key={d.id} className="hover:bg-foam"><Td>{fmtDate(d.delivery_date)}</Td><Td>{d.customers?.name}</Td><Td>{qtyOf(d)}</Td><Td>{d.profiles?.full_name || "—"}</Td>
                <Td><Badge text={d.status} tone={STATUS_TONE(d.status)} /></Td><Td>{pkr(d.amount_collected)}</Td><Td className="max-w-[220px] truncate">{d.rider_remarks || "—"}</Td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
