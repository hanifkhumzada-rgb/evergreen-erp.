import { createClient } from "@/lib/supabase/server";
import { Badge, ExportExcelButton, PrintButton, Th, Td, pkr, fmtDate } from "@/components/ui";
import MarkDeliveredButton from "@/components/MarkDeliveredButton";
import { Phone, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";
function todayISO() { return new Date().toISOString().slice(0, 10); }

export default async function DeliveriesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile.role === "delivery_boy") {
    const { data: employee } = await supabase.from("employees").select("id").eq("user_id", user.id).maybeSingle();
    const { data: deliveries } = employee
      ? await supabase.from("deliveries").select("*, customers(*)").eq("employee_id", employee.id).eq("del_date", todayISO())
      : { data: [] };

    return (
      <div>
        <h2 className="font-display text-2xl font-semibold mb-4">Today&apos;s Route</h2>
        <div className="flex flex-col gap-3">
          {!employee && <p className="text-sm text-slate">No employee record is linked to your login yet — ask the Owner to link it.</p>}
          {employee && (deliveries || []).length === 0 && <p className="text-sm text-slate">No deliveries assigned for today.</p>}
          {(deliveries || []).map((d) => (
            <div key={d.id} className="border border-line rounded-2xl p-4">
              <div className="flex justify-between"><strong>{d.customers?.name}</strong><Badge text={d.status} tone={d.status === "Delivered" ? "green" : "amber"} /></div>
              <p className="text-xs text-slate my-1">{d.customers?.address}</p>
              <p className="text-sm">Qty: <strong>{d.qty}</strong> · Empty expected: <strong>{d.empty_expected}</strong></p>
              <div className="flex gap-2 mt-2.5 flex-wrap">
                <a href={`tel:${d.customers?.phone}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-white text-xs font-semibold"><Phone size={14} /> Call</a>
                {d.customers?.whatsapp && <a href={`https://wa.me/${d.customers.whatsapp.replace(/^0/, "92")}`} target="_blank" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-white text-xs font-semibold"><MessageCircle size={14} /> WhatsApp</a>}
                {d.status !== "Delivered" && <MarkDeliveredButton deliveryId={d.id} emptyExpected={d.empty_expected} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { data: deliveries } = await supabase.from("deliveries").select("*, customers(name), employees(name)").order("del_date", { ascending: false }).limit(200);
  const exportRows = (deliveries || []).map((d) => ({ Date: d.del_date, Customer: d.customers?.name, Qty: d.qty, DeliveryBoy: d.employees?.name, Status: d.status, CashCollected: d.cash_collected }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Deliveries</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="evergreen-deliveries.xlsx" sheetName="Deliveries" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Delivery Boy</Th><Th>Status</Th><Th>Cash Collected</Th></tr></thead>
          <tbody>
            {(deliveries || []).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No deliveries yet.</td></tr>}
            {(deliveries || []).map((d) => (
              <tr key={d.id} className="hover:bg-foam"><Td>{fmtDate(d.del_date)}</Td><Td>{d.customers?.name}</Td><Td>{d.qty}</Td><Td>{d.employees?.name || "—"}</Td>
                <Td><Badge text={d.status} tone={d.status === "Delivered" ? "green" : "amber"} /></Td><Td>{pkr(d.cash_collected)}</Td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
