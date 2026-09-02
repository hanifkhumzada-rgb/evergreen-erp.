import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pkr, fmtDate } from "@/lib/format";
import { KPI, Badge, Th, Td, PrintButton, DownloadPdfButton } from "@/components/ui";
import CustomerForm, { EditCustomerTrigger } from "@/components/CustomerForm";

export const dynamic = "force-dynamic";

const INVOICE_TONE = { paid: "green", partially_paid: "amber", sent: "amber", draft: "slate", overdue: "coral", void: "slate" };
const STATUS_BADGE = {
  active: { text: "Active", tone: "green" },
  inactive: { text: "Inactive", tone: "slate" },
  on_hold: { text: "On Hold", tone: "amber" },
  blacklisted: { text: "Blacklisted", tone: "coral" },
};

export default async function CustomerProfilePage({ params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: c }, { data: invoices }, { data: payments }, { data: balanceRow }, { data: bottleRows }, { data: zones }, { data: products }, { data: vehicles }, { data: riders }, { data: profile }] = await Promise.all([
    supabase.from("customers").select("*, zones(name), profiles!customers_assigned_rider_id_fkey(full_name), vehicles(registration_no)").eq("id", params.id).single(),
    supabase.from("invoices").select("*").eq("customer_id", params.id).order("invoice_date", { ascending: false }).limit(8),
    supabase.from("payments").select("*").eq("customer_id", params.id).order("payment_date", { ascending: false }).limit(8),
    supabase.from("v_customer_balance").select("balance").eq("customer_id", params.id).maybeSingle(),
    supabase.from("v_customer_bottle_balance").select("bottles_with_customer").eq("customer_id", params.id),
    supabase.from("zones").select("*"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("vehicles").select("id, registration_no").eq("is_active", true).order("registration_no"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").eq("roles.key", "rider").eq("is_active", true).order("full_name"),
    supabase.from("profiles").select("roles(key)").eq("id", user.id).single(),
  ]);

  if (!c) {
    return (
      <div>
        <Link href="/customers" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customers</Link>
        <p>Customer not found.</p>
      </div>
    );
  }

  const totalSales = (invoices || []).reduce((a, s) => a + Number(s.net_amount), 0);
  const totalPaid = (payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const balance = Number(balanceRow?.balance || 0);
  const bottleBalance = (bottleRows || []).reduce((a, b) => a + Number(b.bottles_with_customer), 0);
  const statusBadge = STATUS_BADGE[c.status] || (c.is_active ? STATUS_BADGE.active : STATUS_BADGE.inactive);
  const canManageFinancial = ["owner", "admin"].includes(profile?.roles?.key);

  return (
    <div className="print-area">
      <Link href="/customers" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customers</Link>

      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
            <Badge text={statusBadge.text} tone={statusBadge.tone} />
          </div>
          <p className="text-slate text-sm mt-1">{c.customer_type} · {c.zones?.name || "No zone"} · Customer since {fmtDate(c.created_at)}</p>
        </div>
        <div className="no-print flex gap-2">
          <CustomerForm
            mode="edit" customer={c}
            zones={zones || []} products={products || []} vehicles={vehicles || []} riders={riders || []}
            canManageFinancial={canManageFinancial}
            trigger={<EditCustomerTrigger />}
          />
          <DownloadPdfButton href={`/api/pdf/customer-statement/${c.id}`} label="Download Statement" />
          <PrintButton />
        </div>
      </div>

      <div className="flex flex-wrap gap-3.5 mb-6">
        <KPI label="TOTAL SALES" value={pkr(totalSales)} tone="navy" />
        <KPI label="TOTAL PAID" value={pkr(totalPaid)} tone="green" />
        <KPI label="OUTSTANDING" value={pkr(balance)} tone="coral" />
        <KPI label="BOTTLE BALANCE" value={bottleBalance} tone="aqua" sub="net bottles currently with this customer" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-[13.5px] font-bold mb-2">Recent invoices</h4>
          <table className="w-full text-xs border-collapse border border-line rounded-xl overflow-hidden">
            <thead><tr className="bg-foam"><Th>Date</Th><Th>Invoice #</Th><Th>Total</Th><Th>Status</Th></tr></thead>
            <tbody>
              {(invoices || []).length === 0 && <tr><td colSpan={4} className="text-center py-5 text-slate">No invoices yet.</td></tr>}
              {(invoices || []).map((s) => (
                <tr key={s.id}><Td>{fmtDate(s.invoice_date)}</Td><Td>{s.invoice_no}</Td><Td>{pkr(s.net_amount)}</Td>
                  <Td><Badge text={s.status} tone={INVOICE_TONE[s.status] || "slate"} /></Td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h4 className="text-[13.5px] font-bold mb-2">Payments received</h4>
          <table className="w-full text-xs border-collapse border border-line rounded-xl overflow-hidden">
            <thead><tr className="bg-foam"><Th>Date</Th><Th>Amount</Th><Th>Method</Th></tr></thead>
            <tbody>
              {(payments || []).length === 0 && <tr><td colSpan={3} className="text-center py-5 text-slate">No payments yet.</td></tr>}
              {(payments || []).map((p) => <tr key={p.id}><Td>{fmtDate(p.payment_date)}</Td><Td>{pkr(p.amount)}</Td><Td>{p.method}</Td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-[13.5px] font-bold mb-2">Contact &amp; delivery details</h4>
        <div className="flex gap-x-5 gap-y-1.5 flex-wrap text-[13px] text-slate">
          <span>{c.mobile}</span>
          {c.whatsapp_number && <span>WhatsApp: {c.whatsapp_number}</span>}
          {c.email && <span>{c.email}</span>}
          {c.contact_person && <span>Contact: {c.contact_person}</span>}
          <span>{c.address}{c.area ? `, ${c.area}` : ""}</span>
          {c.route && <span>Route: {c.route}</span>}
          {c.preferred_delivery_time && <span>{c.preferred_delivery_time}</span>}
          {c.profiles?.full_name && <span>Driver: {c.profiles.full_name}</span>}
          {c.vehicles?.registration_no && <span>Vehicle: {c.vehicles.registration_no}</span>}
          {c.payment_terms && <span>Terms: {c.payment_terms}</span>}
          <span>Credit limit: {pkr(c.credit_limit)}</span>
        </div>
        {c.delivery_instructions && <p className="text-[13px] text-slate mt-2"><span className="font-semibold">Delivery instructions:</span> {c.delivery_instructions}</p>}
        {c.notes && <p className="text-[13px] text-slate mt-1"><span className="font-semibold">Notes:</span> {c.notes}</p>}
      </div>
    </div>
  );
}
