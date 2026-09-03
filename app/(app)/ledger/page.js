import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, KPI, ExportExcelButton, PrintButton, DownloadPdfButton, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

// customer_ledger_entries.reference_type, as posted by the DB triggers
// (fn_post_opening_balance / fn_post_invoice_to_ledger / record_delivery_completion
// / fn_post_payment_to_ledger) — this is the same table v_customer_balance
// sums, so the running balance here always agrees with the balance shown
// everywhere else (Customers, customer profile, dashboard).
const TYPE_BADGE = {
  opening: { text: "Opening", tone: "slate" },
  invoice: { text: "Sale", tone: "coral" },
  delivery: { text: "Delivery", tone: "coral" },
  payment: { text: "Payment", tone: "green" },
};

export default async function LedgerPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();

  if (sp.customer) {
    return <CustomerTimeline supabase={supabase} customerId={sp.customer} />;
  }

  const q = (sp.q || "").trim().toLowerCase();
  const [{ data: customers }, { data: balances }] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
  ]);
  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const allRows = (customers || []).map((c) => ({ ...c, balance: balanceMap[c.id] || 0 }));
  const rows = q
    ? allRows.filter((c) => [c.code, c.name, c.mobile].filter(Boolean).join(" ").toLowerCase().includes(q))
    : allRows;

  const totalOutstanding = allRows.reduce((a, c) => a + Math.max(c.balance, 0), 0);
  const totalCredit = allRows.reduce((a, c) => a + Math.max(-c.balance, 0), 0);
  const customersWithBalance = allRows.filter((c) => c.balance > 0).length;
  const exportRows = allRows.map((c) => ({ Customer: c.name, Opening: c.opening_balance, CurrentBalance: c.balance, CreditLimit: c.credit_limit }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Customer Ledger</h2>
      <p className="text-slate text-sm mb-4">Pick a customer to see their ledger as a running timeline.</p>

      <div className="flex flex-wrap gap-3.5 mb-5">
        <KPI label="TOTAL RECEIVABLE" value={pkr(totalOutstanding)} tone="coral" />
        <KPI label="CUSTOMERS WITH BALANCE" value={customersWithBalance} tone="amber" />
        <KPI label="CREDIT BALANCES" value={pkr(totalCredit)} tone="green" sub="customers who have overpaid" />
        <KPI label="TOTAL CUSTOMERS" value={allRows.length} tone="navy" />
      </div>

      <form className="no-print flex flex-wrap gap-2.5 mb-2 items-center" action="/ledger">
        <input type="text" name="q" defaultValue={sp.q || ""} placeholder="Search name, ID, phone…" className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-56" />
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Search</button>
        {q && <Link href="/ledger" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>
      {/* Sibling <div>, not inside the search <form> above — same
          missing-type="button" issue that broke /customers' "New Customer". */}
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="evergreen-ledger.xlsx" sheetName="Ledger" />
        <DownloadPdfButton href="/api/pdf/outstanding" label="Download Outstanding PDF" />
        <PrintButton />
      </div>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Customer</Th><Th>Opening</Th><Th>Current Balance</Th><Th>Credit Limit</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate">No customers match.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-foam cursor-pointer">
                <Td><Link href={`/ledger?customer=${c.id}`} className="font-semibold text-navy hover:text-aqua">{c.name}</Link></Td>
                <Td>{pkr(c.opening_balance)}</Td>
                <Td><span className={c.balance > 0 ? "text-coral font-semibold" : "text-green font-semibold"}>{pkr(c.balance)}</span></Td>
                <Td>{pkr(c.credit_limit)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function CustomerTimeline({ supabase, customerId }) {
  const [{ data: c }, { data: entries }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
    supabase.from("customer_ledger_entries").select("*").eq("customer_id", customerId).order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
  ]);

  if (!c) {
    return (
      <div>
        <Link href="/ledger" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customer Ledger</Link>
        <p>Customer not found.</p>
      </div>
    );
  }

  // Running balance walks the same rows v_customer_balance sums, oldest
  // first, so the final running balance always matches the customer's
  // balance shown on Customers/the profile page/the dashboard.
  let running = 0;
  const chronological = (entries || []).map((e) => {
    running += Number(e.debit) - Number(e.credit);
    return { ...e, runningBalance: running };
  });
  const currentBalance = running;
  const timeline = [...chronological].reverse();

  const totalSales = chronological.filter((e) => e.reference_type === "invoice" || e.reference_type === "delivery").reduce((a, e) => a + Number(e.debit), 0);
  const totalPayments = chronological.filter((e) => e.reference_type === "payment").reduce((a, e) => a + Number(e.credit), 0);
  const totalAdjustments = chronological
    .filter((e) => !["invoice", "delivery", "payment", "opening"].includes(e.reference_type))
    .reduce((a, e) => a + Number(e.debit) - Number(e.credit), 0);

  return (
    <div>
      <Link href="/ledger" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customer Ledger</Link>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
          <p className="text-slate text-sm mt-1"><span className="font-mono-num">{c.code || "—"}</span> · {c.mobile}</p>
        </div>
        <div className="no-print flex gap-2">
          <DownloadPdfButton href={`/api/pdf/customer-statement/${c.id}`} label="Download Statement" />
          <PrintButton />
          <Link href={`/customers/${c.id}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold">Full Profile</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3.5 mb-6">
        <KPI label="OPENING BALANCE" value={pkr(c.opening_balance)} tone="slate" />
        <KPI label="SALES" value={pkr(totalSales)} tone="navy" sub="invoices + deliveries" />
        <KPI label="PAYMENTS" value={pkr(totalPayments)} tone="green" />
        {totalAdjustments !== 0 && <KPI label="ADJUSTMENTS" value={pkr(totalAdjustments)} tone="amber" />}
        <KPI label="CURRENT BALANCE" value={pkr(currentBalance)} tone={currentBalance > 0 ? "coral" : "green"} />
      </div>

      <h3 className="font-display text-base font-semibold mb-3">Timeline</h3>
      {timeline.length === 0 && <p className="text-sm text-slate py-8 text-center border border-line rounded-2xl">No ledger entries yet.</p>}
      <div className="flex flex-col">
        {timeline.map((e, i) => {
          const badge = TYPE_BADGE[e.reference_type] || { text: e.reference_type || "Adjustment", tone: "amber" };
          const signedAmount = Number(e.debit) > 0 ? Number(e.debit) : -Number(e.credit);
          return (
            <div key={e.id} className={`flex items-center gap-4 py-3.5 px-1 ${i !== timeline.length - 1 ? "border-b border-line" : ""}`}>
              <div className="w-24 flex-shrink-0 text-xs text-slate">{fmtDate(e.entry_date)}</div>
              <div className="w-24 flex-shrink-0"><Badge text={badge.text} tone={badge.tone} /></div>
              <div className="flex-1 min-w-0 text-[13.5px] truncate">{e.description}</div>
              <div className={`w-28 flex-shrink-0 text-right font-mono-num text-[13.5px] font-semibold ${signedAmount >= 0 ? "text-coral" : "text-green"}`}>
                {signedAmount >= 0 ? "+" : "−"}{pkr(Math.abs(signedAmount))}
              </div>
              <div className="w-32 flex-shrink-0 text-right font-mono-num text-[13.5px] text-slate">{pkr(e.runningBalance)}</div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate mt-3">Amount: + increases what the customer owes (sales/deliveries), − reduces it (payments). Running balance reads top-to-bottom as most recent first.</p>
    </div>
  );
}
