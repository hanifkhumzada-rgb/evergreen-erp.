import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pkr, fmtDate, refNoFromDescription } from "@/lib/format";
import { KPI, Badge, DocumentActionBar, Th, Td } from "@/components/ui";
import WhatsAppButton from "@/components/WhatsAppButton";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import { getBrandingLite } from "@/lib/pdf/business";

export const dynamic = "force-dynamic";

const TXN_TYPE_LABEL = {
  opening: "Opening Balance", delivery: "Delivery", delivery_void: "Delivery Reversed",
  payment: "Payment", payment_void: "Payment Reversed", invoice: "Invoice",
  invoice_void: "Invoice Reversed", invoice_adjustment: "Invoice/Adjustment",
};

export default async function LedgerPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();

  if (sp.customer) {
    return <CustomerTimeline supabase={supabase} customerId={sp.customer} searchParams={sp} />;
  }

  const q = (sp.q || "").trim().toLowerCase();
  const zoneFilter = sp.zone || "";
  const outstandingOnly = sp.outstanding === "1";
  const [branding, { data: customers }, { data: balances }, { data: zones }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("customers").select("*, zones(name)").order("name"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
    supabase.from("zones").select("id, name").order("name"),
  ]);
  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const allRows = (customers || []).map((c) => ({ ...c, balance: balanceMap[c.id] || 0, zone_name: c.zones?.name }));
  let rows = q
    ? allRows.filter((c) => [c.code, c.name, c.mobile].filter(Boolean).join(" ").toLowerCase().includes(q))
    : allRows;
  if (zoneFilter) rows = rows.filter((c) => c.zone_id === zoneFilter);
  if (outstandingOnly) rows = rows.filter((c) => c.balance > 0);

  const totalOutstanding = allRows.reduce((a, c) => a + Math.max(c.balance, 0), 0);
  const totalCredit = allRows.reduce((a, c) => a + Math.max(-c.balance, 0), 0);
  const customersWithBalance = allRows.filter((c) => c.balance > 0).length;
  const exportRows = rows.map((c) => ({ Customer: c.name, Zone: c.zone_name || "", Opening: c.opening_balance, CurrentBalance: c.balance, CreditLimit: c.credit_limit }));

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Customer Ledger" meta={`${rows.length} of ${allRows.length} customers\nGenerated ${fmtDate(new Date().toISOString())}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Customer Ledger</h2>
      <p className="no-print text-slate text-sm mb-4">Pick a customer to see their full account statement.</p>

      <div className="no-print flex flex-wrap gap-3.5 mb-5">
        <KPI label="TOTAL RECEIVABLE" value={pkr(totalOutstanding)} tone="coral" />
        <KPI label="CUSTOMERS WITH BALANCE" value={customersWithBalance} tone="amber" />
        <KPI label="CREDIT BALANCES" value={pkr(totalCredit)} tone="green" sub="customers who have overpaid" />
        <KPI label="TOTAL CUSTOMERS" value={allRows.length} tone="navy" />
      </div>

      <form className="no-print flex flex-wrap gap-2.5 mb-4 items-center" action="/ledger">
        <input type="text" name="q" defaultValue={sp.q || ""} placeholder="Search name, ID, phone…" className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-56" />
        <select name="zone" defaultValue={zoneFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All zones</option>
          {(zones || []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate px-1">
          <input type="checkbox" name="outstanding" value="1" defaultChecked={outstandingOnly} /> Outstanding only
        </label>
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Filter</button>
        {(q || zoneFilter || outstandingOnly) && <Link href="/ledger" className="text-xs text-slate hover:text-aqua">Clear</Link>}
        <div className="flex-1" />
        <DocumentActionBar
          print
          pdfHref="/api/pdf/outstanding"
          pdfLabel="Outstanding Report"
          excel={{ rows: exportRows, sheetName: "Ledger", reportTitle: "Customer Ledger", branding }}
          share={{ title: "Customer Ledger" }}
        />
      </form>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead className="sticky top-0"><tr className="bg-foam"><Th>Customer</Th><Th>Zone</Th><Th>Opening</Th><Th>Current Balance</Th><Th>Credit Limit</Th><Th className="no-print">&nbsp;</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No customers match.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-foam cursor-pointer">
                <Td><Link href={`/ledger?customer=${c.id}`} className="font-semibold text-navy hover:text-aqua">{c.name}</Link></Td>
                <Td className="text-slate">{c.zone_name || "—"}</Td>
                <Td>{pkr(c.opening_balance)}</Td>
                <Td><span className={c.balance > 0 ? "text-coral font-semibold" : "text-green font-semibold"}>{pkr(c.balance)}</span></Td>
                <Td>{pkr(c.credit_limit)}</Td>
                <Td className="no-print">
                  {c.balance > 0 && (
                    <WhatsAppButton phone={c.mobile}
                      message={`Hi ${c.name}, this is a friendly reminder from Evergreen Water — your current outstanding balance is Rs ${Math.round(c.balance).toLocaleString("en-PK")}. Please arrange payment at your earliest convenience. Thank you!`} />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DocumentPrintFooter />
    </div>
  );
}

async function CustomerTimeline({ supabase, customerId, searchParams }) {
  const sp = searchParams || {};
  const [branding, { data: c }, { data: entries }, { data: pendingSmart }, { data: ageing }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("customers").select("*, zones(name)").eq("id", customerId).maybeSingle(),
    supabase.from("customer_ledger_entries")
      .select("*, smart_entries(entry_no, status, decision_reason, creator:profiles!smart_entries_created_by_fkey(full_name), approver:profiles!smart_entries_approved_by_fkey(full_name)), entered_by:profiles!customer_ledger_entries_created_by_fkey(full_name)")
      .eq("customer_id", customerId).order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("smart_entries").select("id, entry_no, entry_type, status, decision_reason, created_at, payload")
      .contains("payload", { customer_id: customerId }).in("status", ["draft", "pending_approval", "rejected", "failed"])
      .order("created_at", { ascending: false }).limit(20),
    supabase.rpc("fn_customer_ageing", { p_customer_id: customerId }),
  ]);

  if (!c) {
    return (
      <div>
        <Link href="/ledger" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customer Ledger</Link>
        <p>Customer not found.</p>
      </div>
    );
  }

  const openingBalance = Number(c.opening_balance) || 0;
  let running = openingBalance;
  let bottleRunning = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  let totalDeliveries = 0;
  const allChronological = (entries || []).filter((e) => e.reference_type !== "opening").map((e) => {
    const debit = Number(e.debit) || 0;
    const credit = Number(e.credit) || 0;
    running += debit - credit;
    totalDebit += debit;
    totalCredit += credit;
    if (e.reference_type === "delivery") totalDeliveries += debit;
    bottleRunning += (Number(e.bottles_out) || 0) - (Number(e.bottles_in) || 0);
    return { ...e, runningBalance: running, runningBottles: bottleRunning };
  });
  const closingBalance = running;
  const closingBottles = bottleRunning;

  // Filters — applied after the running-balance walk so the balance column
  // always reflects the true chronological running total, never a total
  // recomputed from just the filtered subset.
  const dateFrom = sp.from || "";
  const dateTo = sp.to || "";
  const month = sp.month || "";
  const typeFilter = sp.type || "";
  let chronological = allChronological;
  if (dateFrom) chronological = chronological.filter((e) => e.entry_date >= dateFrom);
  if (dateTo) chronological = chronological.filter((e) => e.entry_date <= dateTo);
  if (month) chronological = chronological.filter((e) => (e.entry_date || "").slice(0, 7) === month);
  if (typeFilter) chronological = chronological.filter((e) => e.reference_type === typeFilter);

  // FIFO payment-status per debit row — same algorithm as fn_customer_ageing:
  // walk debits oldest-first, consume the customer's total credit pool
  // against the earliest debits first, whatever remains unconsumed on a row
  // is what's still unpaid on it.
  let creditPool = totalCredit;
  const withPaymentStatus = chronological.map((e) => {
    const debit = Number(e.debit) || 0;
    if (debit <= 0) return { ...e, paymentStatus: null };
    const consumed = Math.min(debit, Math.max(creditPool, 0));
    creditPool -= consumed;
    const outstanding = debit - consumed;
    const paymentStatus = outstanding <= 0.01 ? "Paid" : consumed > 0 ? "Partial" : "Unpaid";
    return { ...e, paymentStatus };
  });

  const ageRow = Array.isArray(ageing) ? ageing[0] : ageing;
  const referenceTypes = [...new Set(allChronological.map((e) => e.reference_type))];

  const exportRows = withPaymentStatus.map((e) => ({
    Date: e.entry_date, Reference: e.smart_entries?.entry_no || refNoFromDescription(e.description), Type: TXN_TYPE_LABEL[e.reference_type] || e.reference_type,
    Description: e.description, BottlesOut: e.bottles_out || "", BottlesReturned: e.bottles_in || "",
    Debit: e.debit, Credit: e.credit, RunningOutstanding: e.runningBalance, PaymentStatus: e.paymentStatus || "",
    EnteredBy: e.smart_entries?.creator?.full_name || e.entered_by?.full_name || "", ApprovedBy: e.smart_entries?.approver?.full_name || "",
  }));

  const statementMessage = `Hi ${c.name}, here is your Evergreen Water account summary — Opening: Rs ${Math.round(openingBalance).toLocaleString("en-PK")}, Total Deliveries: Rs ${Math.round(totalDeliveries).toLocaleString("en-PK")}, Total Received: Rs ${Math.round(totalCredit).toLocaleString("en-PK")}, Current Outstanding: Rs ${Math.round(closingBalance).toLocaleString("en-PK")}. ${closingBalance > 0 ? "Please arrange payment at your earliest convenience. " : ""}Thank you for choosing Evergreen Water!`;

  return (
    <div>
      <DocumentPrintHeader printOnly={false} branding={branding} title="Client Account Statement"
        meta={`Period: All activity to date\nGenerated: ${fmtDate(new Date().toISOString())}`} />
      <div className="no-print flex items-center gap-1.5 text-xs text-slate mb-3">
        <Link href="/ledger" className="hover:text-aqua font-semibold">Customer Ledger</Link><span>/</span><span className="text-ink font-semibold">{c.name}</span>
      </div>
      <Link href="/ledger" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customer Ledger</Link>
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <div className="text-[10px] font-bold text-slate uppercase tracking-wide mb-1">Statement For</div>
          <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
          <p className="text-slate text-sm mt-1">Client ID: <span className="font-mono-num">{c.code || "—"}</span> · {[c.mobile, c.address, c.zones?.name].filter(Boolean).join("  ·  ")}</p>
        </div>
        <div className="no-print flex gap-2 flex-wrap">
          <WhatsAppButton phone={c.mobile} message={statementMessage} label="WhatsApp Statement" />
          <DocumentActionBar
            print
            pdfHref={`/api/pdf/customer-statement/${c.id}`}
            pdfLabel="Statement"
            excel={{ rows: exportRows, sheetName: "Statement", reportTitle: `${c.name} — Statement`, branding }}
            share={{ title: `${c.name} — Account Statement` }}
          />
          <Link href={`/customers/${c.id}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold">Full Profile</Link>
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-3.5 mb-5">
        <KPI label="OPENING BALANCE" value={pkr(openingBalance)} tone="navy" />
        <KPI label="TOTAL DELIVERIES" value={pkr(totalDeliveries)} tone="aqua" />
        <KPI label="TOTAL RECEIVED" value={pkr(totalCredit)} tone="green" />
        <KPI label="CURRENT OUTSTANDING" value={pkr(closingBalance)} tone={closingBalance > 0 ? "coral" : "green"} />
        <KPI label="BOTTLE BALANCE" value={closingBottles} tone="amber" sub="with customer" />
      </div>

      {ageRow && (
        <div className="no-print mb-5">
          <h3 className="font-display text-sm font-semibold mb-2">Ageing (Outstanding)</h3>
          <div className="flex flex-wrap gap-2.5">
            {[["Current", ageRow.current_amt], ["1–30 Days", ageRow.d1_30], ["31–60 Days", ageRow.d31_60], ["61–90 Days", ageRow.d61_90], ["90+ Days", ageRow.d90_plus]].map(([label, val]) => (
              <div key={label} className={`flex-1 min-w-[110px] rounded-xl border border-line px-3 py-2.5 ${Number(val) > 0 ? "bg-coralSoft/40" : "bg-foam"}`}>
                <div className="text-[10px] text-slate font-semibold uppercase">{label}</div>
                <div className="font-mono-num text-sm font-bold mt-0.5">{pkr(val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingSmart?.length > 0 && (
        <div className="no-print mb-5 rounded-2xl border border-amber/40 bg-amberSoft/50 p-4">
          <h3 className="font-display text-sm font-semibold mb-2">Pending / Draft / Rejected Entries <span className="font-normal text-slate">(not included in the balance below)</span></h3>
          <div className="space-y-1.5">
            {pendingSmart.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2 border border-line">
                <span><strong>{e.entry_no}</strong> · {e.entry_type} · {fmtDate(e.created_at)}</span>
                <span className="flex items-center gap-2">
                  <Badge text={e.status === "pending_approval" ? "Pending Approval" : e.status === "rejected" ? "Rejected" : e.status === "failed" ? "Failed" : "Draft"} tone={e.status === "pending_approval" ? "amber" : e.status === "rejected" || e.status === "failed" ? "coral" : "slate"} />
                  <Link href="/smart-entry" className="text-aqua font-semibold hover:underline">Open</Link>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <form action={`/ledger`} className="no-print flex flex-wrap gap-2 mb-3 items-center">
        <input type="hidden" name="customer" value={customerId} />
        <input type="date" name="from" defaultValue={dateFrom} className="px-2.5 py-1.5 rounded-lg border border-line bg-card text-xs" />
        <span className="text-xs text-slate">to</span>
        <input type="date" name="to" defaultValue={dateTo} className="px-2.5 py-1.5 rounded-lg border border-line bg-card text-xs" />
        <input type="month" name="month" defaultValue={month} className="px-2.5 py-1.5 rounded-lg border border-line bg-card text-xs" />
        <select name="type" defaultValue={typeFilter} className="px-2.5 py-1.5 rounded-lg border border-line bg-card text-xs">
          <option value="">All transaction types</option>
          {referenceTypes.map((t) => <option key={t} value={t}>{TXN_TYPE_LABEL[t] || t}</option>)}
        </select>
        <button type="submit" className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-semibold">Apply</button>
        {(dateFrom || dateTo || month || typeFilter) && <Link href={`/ledger?customer=${customerId}`} className="text-xs text-slate hover:text-aqua">Clear filters</Link>}
      </form>

      <div className="overflow-x-auto border border-line rounded-2xl mb-4">
        <table className="w-full text-[12.5px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-foam">
              <Th>Date</Th><Th>Reference</Th><Th>Type</Th><Th>Description</Th>
              <Th>Bottles Out</Th><Th>Bottles In</Th><Th>Bottle Balance</Th>
              <Th className="text-right">Debit</Th><Th className="text-right">Credit</Th><Th className="text-right">Outstanding</Th>
              <Th>Payment Status</Th><Th>Entry Status</Th><Th>Entered By</Th><Th>Approved By</Th><Th>Remarks</Th><Th className="no-print">View</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-foam font-semibold">
              <Td>—</Td><Td>—</Td><Td>Opening</Td><Td>Opening Balance</Td>
              <Td>—</Td><Td>—</Td><Td>—</Td>
              <Td className="text-right">—</Td><Td className="text-right">—</Td><Td className="text-right">{pkr(openingBalance)}</Td>
              <Td>—</Td><Td><Badge text="Approved" tone="green" /></Td><Td>—</Td><Td>—</Td><Td>—</Td><Td className="no-print">—</Td>
            </tr>
            {withPaymentStatus.length === 0 && <tr><td colSpan={16} className="text-center py-8 text-slate">No ledger activity for this filter.</td></tr>}
            {withPaymentStatus.map((e) => {
              const isVoidRow = (e.reference_type || "").endsWith("_void");
              const viewHref = ["delivery", "delivery_void"].includes(e.reference_type) ? "/deliveries"
                : ["payment", "payment_void"].includes(e.reference_type) ? "/payments"
                : ["invoice", "invoice_void", "invoice_adjustment"].includes(e.reference_type) ? "/invoices" : null;
              return (
                <tr key={e.id} className="hover:bg-foam">
                  <Td>{fmtDate(e.entry_date)}</Td>
                  <Td className="text-slate">{e.smart_entries?.entry_no || refNoFromDescription(e.description)}</Td>
                  <Td>{TXN_TYPE_LABEL[e.reference_type] || e.reference_type}</Td>
                  <Td className="max-w-[220px] truncate" title={e.description}>{e.description}</Td>
                  <Td>{e.bottles_out || "—"}</Td>
                  <Td>{e.bottles_in || "—"}</Td>
                  <Td>{e.runningBottles}</Td>
                  <Td className="text-right text-slate">{e.debit ? pkr(e.debit) : "—"}</Td>
                  <Td className="text-right text-slate">{e.credit ? pkr(e.credit) : "—"}</Td>
                  <Td className="text-right font-semibold">{pkr(e.runningBalance)}</Td>
                  <Td>{e.paymentStatus ? <Badge text={e.paymentStatus} tone={e.paymentStatus === "Paid" ? "green" : e.paymentStatus === "Partial" ? "amber" : "coral"} /> : "—"}</Td>
                  <Td>{isVoidRow ? <Badge text="Reversed" tone="coral" /> : <Badge text="Approved" tone="green" />}</Td>
                  <Td>{e.smart_entries?.creator?.full_name || e.entered_by?.full_name || "—"}</Td>
                  <Td>{e.smart_entries?.approver?.full_name || "—"}</Td>
                  <Td className="max-w-[140px] truncate" title={e.remarks || e.smart_entries?.decision_reason || ""}>{e.remarks || e.smart_entries?.decision_reason || "—"}</Td>
                  <Td className="no-print">{viewHref ? <Link href={viewHref} className="text-aqua font-semibold hover:underline">View</Link> : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-4">
        <div className="w-full sm:w-72 text-[13px]">
          <div className="flex justify-between py-1"><span className="text-slate">Total Debit</span><span>{pkr(totalDebit)}</span></div>
          <div className="flex justify-between py-1"><span className="text-slate">Total Credit</span><span className="text-green">{pkr(totalCredit)}</span></div>
          <div className={`flex justify-between items-center py-2.5 px-3 mt-2 rounded-lg text-white ${closingBalance > 0 ? "bg-navy" : "bg-green"}`}>
            <span className="text-sm font-bold">Closing Balance / Outstanding</span>
            <span className="text-lg font-bold">{pkr(closingBalance)}</span>
          </div>
        </div>
      </div>
      <p className="no-print text-[11px] text-slate">Debit increases what the customer owes (deliveries/invoices), credit reduces it (payments). Only approved transactions are included in the balance and bottle totals above — draft, pending and rejected Smart Entries are shown separately and never affect these figures. Payment Status is computed FIFO (oldest debit paid first).</p>
      <DocumentPrintFooter />
    </div>
  );
}
