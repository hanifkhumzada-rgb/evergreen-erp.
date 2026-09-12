import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, KPI, ExportExcelButton, PrintButton, Th, Td, DownloadPdfButton } from "@/components/ui";
import WhatsAppButton from "@/components/WhatsAppButton";
import AddPaymentForm from "@/components/AddPaymentForm";
import BulkImportButton from "@/components/BulkImportButton";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import { bulkImportPayments, voidPayment } from "@/app/actions";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import { Search } from "lucide-react";

export const dynamic = "force-dynamic";

// Payment Frequency has no stored "next due date" anywhere in this schema —
// so recovery due-dates here are a computed heuristic: last payment date +
// the customer's frequency interval (Daily=1, Weekly=7, Monthly/Custom=30
// days). A customer with an outstanding balance and no payment on file yet
// is treated as already due (there's nothing to wait on). This is an
// estimate for prioritizing follow-up, not a contractual due date.
const FREQ_DAYS = { Daily: 1, Weekly: 7, Monthly: 30, Custom: 30 };
const BUCKET_LABEL = {
  due_today: "Due Today", overdue_1_7: "Overdue 1–7 Days", overdue_8_30: "Overdue 8–30 Days",
  overdue_30_plus: "Overdue 30+ Days", paid_today: "Paid Today",
};
const BUCKET_TONE = { due_today: "amber", overdue_1_7: "coral", overdue_8_30: "coral", overdue_30_plus: "coral", paid_today: "green" };
const PRIORITY_TONE = { URGENT: "coral", HIGH: "amber", MEDIUM: "aqua", LOW: "slate" };
const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// Recovery priority — a sort/filter aid on the existing Recovery list, not
// a financial figure. Weights days overdue, outstanding amount relative to
// the existing "High Outstanding" automation-rule threshold, and whether
// the customer has any payment history at all (no track record on file is
// treated as extra risk, same reasoning as the "already due" heuristic
// above).
function recoveryPriority(daysOverdue, balance, hasHistory, highThreshold) {
  let score = 0;
  score += daysOverdue > 30 ? 4 : daysOverdue > 7 ? 3 : daysOverdue > 0 ? 2 : 0;
  score += balance > highThreshold * 2 ? 3 : balance > highThreshold ? 2 : 0;
  score += hasHistory ? 0 : 1;
  if (score >= 6) return "URGENT";
  if (score >= 4) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}

export default async function PaymentsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  const [branding, { data: payments }, { data: balances }, { data: collectors }, { data: allPayments }, { data: customersMeta }, { data: canVoid }, { data: highRule }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("payments").select("*, customers(name), profiles!payments_received_by_fkey(full_name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("v_customer_balance").select("customer_id, name, balance"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").neq("roles.key", "customer").eq("is_active", true).order("full_name"),
    supabase.from("payments").select("customer_id, payment_date, amount, customers(name)").eq("voided", false).order("payment_date", { ascending: false }),
    supabase.from("customers").select("id, payment_frequency, mobile"),
    supabase.rpc("fn_has_permission", { perm_key: "payments.delete" }),
    // Reuses the existing "Outstanding balance recovery" automation rule
    // (same one refresh_alerts() already alerts the Owner on) as the High
    // Outstanding cutoff, instead of a second hardcoded threshold.
    supabase.from("automation_rules").select("threshold_value").eq("key", "outstanding_balance").maybeSingle(),
  ]);
  const historyQuery = (sp.hq || "").trim().toLowerCase();
  const paymentRows = (payments || []).filter((p) => !historyQuery || `${p.customers?.name || ""} ${p.payment_date || ""} ${p.method || ""} ${p.reference || ""} ${p.profiles?.full_name || ""}`.toLowerCase().includes(historyQuery));
  const exportRows = paymentRows.map((p) => ({ Date: p.payment_date, Customer: p.customers?.name, Amount: p.amount, Method: p.method, Collector: p.profiles?.full_name, Reference: p.reference }));
  const highOutstandingThreshold = Number(highRule?.threshold_value) || 10000;

  const lastPaymentMap = {};
  (allPayments || []).forEach((p) => { if (!lastPaymentMap[p.customer_id]) lastPaymentMap[p.customer_id] = p.payment_date; });
  const freqMap = {};
  const mobileMap = {};
  (customersMeta || []).forEach((c) => { freqMap[c.id] = c.payment_frequency || "Monthly"; mobileMap[c.id] = c.mobile; });

  const todayISO = new Date().toISOString().slice(0, 10);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const paidTodayMap = {};
  (allPayments || []).filter((p) => p.payment_date === todayISO).forEach((p) => {
    const row = paidTodayMap[p.customer_id] || { customerId: p.customer_id, name: p.customers?.name, amount: 0 };
    row.amount += Number(p.amount);
    paidTodayMap[p.customer_id] = row;
  });
  const paidTodaySet = new Set(Object.keys(paidTodayMap));

  const dueList = (balances || [])
    .filter((b) => Number(b.balance) > 0)
    .map((b) => {
      const freq = freqMap[b.customer_id] || "Monthly";
      const last = lastPaymentMap[b.customer_id];
      const dueDate = last ? new Date(new Date(last).getTime() + (FREQ_DAYS[freq] || 30) * 86400000) : null;
      const daysUntilDue = dueDate ? Math.floor((dueDate - today) / 86400000) : null;
      const daysOverdue = dueDate ? Math.max(0, -daysUntilDue) : 999;
      const paidToday = paidTodaySet.has(b.customer_id);
      const isHighOutstanding = Number(b.balance) > highOutstandingThreshold;

      let bucket;
      if (paidToday) bucket = "paid_today";
      else if (dueDate && daysUntilDue === 0) bucket = "due_today";
      else if (daysOverdue > 30) bucket = "overdue_30_plus";
      else if (daysOverdue >= 8) bucket = "overdue_8_30";
      else if (daysOverdue >= 1) bucket = "overdue_1_7";
      else bucket = "upcoming";

      const priority = recoveryPriority(daysOverdue === 999 ? 31 : daysOverdue, Number(b.balance), Boolean(last), highOutstandingThreshold);
      return {
        customerId: b.customer_id, name: b.name, mobile: mobileMap[b.customer_id], balance: Number(b.balance),
        freq, lastPayment: last, dueDate, daysOverdue, bucket, isHighOutstanding, priority,
      };
    });

  const buckets = { due_today: [], overdue_1_7: [], overdue_8_30: [], overdue_30_plus: [] };
  dueList.forEach((d) => { if (buckets[d.bucket]) buckets[d.bucket].push(d); });
  const bucketSum = (arr) => arr.reduce((a, d) => a + d.balance, 0);
  const paidTodayList = Object.values(paidTodayMap);
  const highOutstandingList = dueList.filter((d) => d.isHighOutstanding);

  const bucketFilter = sp.bucket || "";
  let actionable = bucketFilter === "high_outstanding" ? highOutstandingList
    : bucketFilter ? (buckets[bucketFilter] || [])
    : [...buckets.due_today, ...buckets.overdue_1_7, ...buckets.overdue_8_30, ...buckets.overdue_30_plus];
  actionable = [...actionable].sort((a, b) => (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) || (b.balance - a.balance));

  const totalDue = bucketSum(dueList);
  const todaysCollected = (allPayments || []).filter((p) => p.payment_date === todayISO).reduce((a, p) => a + Number(p.amount), 0);
  const overdueTotal = bucketSum(buckets.overdue_1_7) + bucketSum(buckets.overdue_8_30) + bucketSum(buckets.overdue_30_plus);

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Payments" meta={`${(payments || []).length} payments\nGenerated ${fmtDate(todayISO)}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Payment Collection</h2>
      <p className="no-print text-slate text-sm mb-4">Due today, collected today, and every overdue customer that needs a follow-up.</p>

      <div className="no-print flex flex-wrap gap-3.5 mb-5">
        <KPI label="TOTAL DUE" value={pkr(totalDue)} tone="navy" sub={`${dueList.length} customers`} />
        <KPI label="COLLECTED TODAY" value={pkr(todaysCollected)} tone="green" sub={`${paidTodayList.length} customers`} />
        <KPI label="OVERDUE" value={pkr(overdueTotal)} tone="coral" sub={`${buckets.overdue_1_7.length + buckets.overdue_8_30.length + buckets.overdue_30_plus.length} customers`} />
        <KPI label="HIGH OUTSTANDING" value={pkr(bucketSum(highOutstandingList))} tone="amber" sub={`${highOutstandingList.length} customers · over ${pkr(highOutstandingThreshold)}`} />
      </div>

      <h3 className="no-print font-display text-base font-semibold mb-2.5">Daily Payment Recovery Center</h3>
      <div className="no-print flex gap-3 flex-wrap mb-4">
        {[
          { key: "due_today", list: buckets.due_today },
          { key: "overdue_1_7", list: buckets.overdue_1_7 },
          { key: "overdue_8_30", list: buckets.overdue_8_30 },
          { key: "overdue_30_plus", list: buckets.overdue_30_plus },
          { key: "high_outstanding", list: highOutstandingList },
          { key: "paid_today", list: paidTodayList },
        ].map(({ key, list }) => (
          <Link key={key} href={bucketFilter === key ? "/payments" : `/payments?bucket=${key}`}
            className={`text-center flex-1 min-w-[130px] border rounded-2xl py-4 transition-colors ${bucketFilter === key ? "border-aqua bg-aquaSoft" : "border-line hover:bg-foam"}`}>
            <div className={`font-mono-num font-bold text-2xl ${key === "paid_today" ? "text-green" : key.startsWith("overdue") ? "text-coral" : "text-aqua"}`}>{list.length}</div>
            <div className="text-xs text-slate mt-1">{BUCKET_LABEL[key]}</div>
            <div className="text-[10.5px] text-slate mt-0.5">{pkr(list.reduce((a, d) => a + (d.balance ?? d.amount), 0))}</div>
          </Link>
        ))}
        {bucketFilter && <Link href="/payments" className="text-xs text-slate hover:text-aqua self-center">Clear filter</Link>}
      </div>
      {bucketFilter === "paid_today" ? (
        <div className="overflow-x-auto border border-line rounded-2xl mb-6">
          <table className="w-full text-[13.5px] border-collapse">
            <thead><tr className="bg-foam"><Th>Customer</Th><Th>Amount Paid Today</Th></tr></thead>
            <tbody>
              {paidTodayList.length === 0 && <tr><td colSpan={2} className="text-center py-8 text-slate">No payments collected today yet.</td></tr>}
              {paidTodayList.map((d) => (
                <tr key={d.customerId} className="hover:bg-foam">
                  <Td><Link href={`/customers/${d.customerId}`} className="font-semibold text-navy hover:text-aqua">{d.name}</Link></Td>
                  <Td className="text-green font-semibold">{pkr(d.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : actionable.length > 0 && (
        <div className="overflow-x-auto border border-line rounded-2xl mb-6">
          <table className="w-full text-[13.5px] border-collapse">
            <thead><tr className="bg-foam"><Th>Priority</Th><Th>Customer</Th><Th>Amount Due</Th><Th>Due Date</Th><Th>Frequency</Th><Th>Last Payment</Th><Th>Status</Th><Th className="no-print">&nbsp;</Th></tr></thead>
            <tbody>
              {actionable.map((d) => (
                <tr key={d.customerId} className="hover:bg-foam">
                  <Td><Badge text={d.priority} tone={PRIORITY_TONE[d.priority]} /></Td>
                  <Td><Link href={`/customers/${d.customerId}`} className="font-semibold text-navy hover:text-aqua">{d.name}</Link>{d.isHighOutstanding && <div className="text-[10px] text-amber mt-0.5">High outstanding</div>}</Td>
                  <Td className="text-coral font-semibold">{pkr(d.balance)}</Td>
                  <Td>{d.dueDate ? fmtDate(d.dueDate.toISOString()) : "—"}</Td>
                  <Td>{d.freq}</Td>
                  <Td>{d.lastPayment ? fmtDate(d.lastPayment) : "never"}</Td>
                  <Td><Badge text={BUCKET_LABEL[d.bucket] || "Upcoming"} tone={BUCKET_TONE[d.bucket] || "slate"} /></Td>
                  <Td className="no-print">
                    <WhatsAppButton phone={d.mobile}
                      message={`Hi ${d.name}, this is a friendly reminder from Evergreen Water — your current outstanding balance is Rs ${Math.round(d.balance).toLocaleString("en-PK")}. Please arrange payment at your earliest convenience. Thank you!`} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate mb-6">Due dates are estimated from each customer&apos;s payment frequency and last payment date — not a stored due-date field. Priority is a follow-up sort aid (days overdue + outstanding amount + payment history), not a financial figure.</p>

      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <form action="/payments" className="flex items-center gap-2">
          <input type="search" name="hq" defaultValue={sp.hq || ""} placeholder="Search payment history…" className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-52" />
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-bold"><Search size={14} /> Search</button>
          {historyQuery ? <Link href="/payments" className="text-xs text-slate">Clear</Link> : null}
        </form>
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Phone (or Name), Amount, Date, Method"
          action={bulkImportPayments}
          sampleRow={{ Phone: "03001234567", Name: "Ali Traders", Amount: 1000, Date: "2026-08-31", Method: "Cash" }}
          previewType="payments"
        />
        <ExportExcelButton rows={exportRows} sheetName="Payments" reportTitle="Payments" branding={branding} />
        <PrintButton />
        <AddPaymentForm
          customers={(balances || []).map((b) => ({ id: b.customer_id, name: b.name, balance: b.balance, frequency: freqMap[b.customer_id] }))}
          collectors={collectors || []}
          initialCustomerId={sp.customer || ""}
          initialOpen={sp.quick === "new"}
        />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Customer</Th><Th>Amount</Th><Th>Method</Th><Th>Collected By</Th><Th>Reference</Th><Th>Status</Th><Th>&nbsp;</Th></tr></thead>
          <tbody>
            {paymentRows.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate">No payments match.</td></tr>}
            {paymentRows.map((p) => (
              <tr key={p.id} className={`hover:bg-foam ${p.voided ? "opacity-60" : ""}`}>
                <Td>{fmtDate(p.payment_date)}</Td><Td>{p.customers?.name}</Td><Td>{pkr(p.amount)}</Td><Td>{p.method}</Td><Td>{p.profiles?.full_name || "—"}</Td><Td className="text-slate">{p.reference || "—"}</Td>
                <Td>{p.voided ? <><Badge text="Voided" tone="coral" />{p.void_reason && <div className="text-[10px] text-slate mt-1 max-w-[140px]">{p.void_reason}</div>}</> : <Badge text="Active" tone="green" />}</Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <DownloadPdfButton href={`/api/pdf/payment-receipt/${p.id}`} label="Voucher" />
                    {p.method === "bank" && <DownloadPdfButton href={`/api/pdf/bank-payment-voucher/payments/${p.id}`} label="BPV" />}
                    {canVoid && !p.voided && <ReasonConfirmButton action={voidPayment} id={p.id} confirmText={`Void payment of ${pkr(p.amount)} from ${p.customers?.name}?`} />}
                  </div>
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
