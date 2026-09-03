import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, KPI, ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import AddPaymentForm from "@/components/AddPaymentForm";
import BulkImportButton from "@/components/BulkImportButton";
import { bulkImportPayments } from "@/app/actions";

export const dynamic = "force-dynamic";

// Payment Frequency has no stored "next due date" anywhere in this schema —
// so recovery due-dates here are a computed heuristic: last payment date +
// the customer's frequency interval (Daily=1, Weekly=7, Monthly/Custom=30
// days). A customer with an outstanding balance and no payment on file yet
// is treated as already due (there's nothing to wait on). This is an
// estimate for prioritizing follow-up, not a contractual due date.
const FREQ_DAYS = { Daily: 1, Weekly: 7, Monthly: 30, Custom: 30 };
const BUCKET_LABEL = { overdue: "Overdue", today: "Today", week: "This Week", month: "This Month" };
const BUCKET_TONE = { overdue: "coral", today: "amber", week: "aqua", month: "slate" };

export default async function PaymentsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  const [{ data: payments }, { data: balances }, { data: collectors }, { data: allPayments }, { data: customersMeta }] = await Promise.all([
    supabase.from("payments").select("*, customers(name), profiles!payments_received_by_fkey(full_name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("v_customer_balance").select("customer_id, name, balance"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").neq("roles.key", "customer").eq("is_active", true).order("full_name"),
    supabase.from("payments").select("customer_id, payment_date, amount").order("payment_date", { ascending: false }),
    supabase.from("customers").select("id, payment_frequency"),
  ]);
  const exportRows = (payments || []).map((p) => ({ Date: p.payment_date, Customer: p.customers?.name, Amount: p.amount, Method: p.method, Collector: p.profiles?.full_name, Reference: p.reference }));

  const lastPaymentMap = {};
  (allPayments || []).forEach((p) => { if (!lastPaymentMap[p.customer_id]) lastPaymentMap[p.customer_id] = p.payment_date; });
  const freqMap = {};
  (customersMeta || []).forEach((c) => { freqMap[c.id] = c.payment_frequency || "Monthly"; });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueList = (balances || [])
    .filter((b) => Number(b.balance) > 0)
    .map((b) => {
      const freq = freqMap[b.customer_id] || "Monthly";
      const last = lastPaymentMap[b.customer_id];
      const dueDate = last ? new Date(new Date(last).getTime() + (FREQ_DAYS[freq] || 30) * 86400000) : null;
      const daysUntilDue = dueDate ? Math.floor((dueDate - today) / 86400000) : -1;
      let bucket = "later";
      if (!dueDate || daysUntilDue < 0) bucket = "overdue";
      else if (daysUntilDue === 0) bucket = "today";
      else if (daysUntilDue <= 7) bucket = "week";
      else if (daysUntilDue <= 30) bucket = "month";
      return { customerId: b.customer_id, name: b.name, balance: Number(b.balance), freq, lastPayment: last, dueDate, bucket };
    });

  const buckets = { overdue: [], today: [], week: [], month: [] };
  dueList.forEach((d) => { if (buckets[d.bucket]) buckets[d.bucket].push(d); });
  const bucketSum = (arr) => arr.reduce((a, d) => a + d.balance, 0);
  const actionable = [...buckets.overdue, ...buckets.today].sort((a, b) => a.balance === b.balance ? 0 : b.balance - a.balance);

  const todayISO = new Date().toISOString().slice(0, 10);
  const todaysDue = bucketSum(buckets.today);
  const todaysCollected = (allPayments || []).filter((p) => p.payment_date === todayISO).reduce((a, p) => a + Number(p.amount), 0);
  const todaysRemaining = Math.max(0, todaysDue - todaysCollected);
  const overdueTotal = bucketSum(buckets.overdue);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Payment Collection</h2>
      <p className="text-slate text-sm mb-4">Due today, collected today, and every overdue customer that needs a follow-up.</p>

      <div className="flex flex-wrap gap-3.5 mb-5">
        <KPI label="TODAY'S DUE" value={pkr(todaysDue)} tone="navy" />
        <KPI label="COLLECTED" value={pkr(todaysCollected)} tone="green" />
        <KPI label="REMAINING" value={pkr(todaysRemaining)} tone={todaysRemaining > 0 ? "amber" : "slate"} />
        <KPI label="OVERDUE" value={pkr(overdueTotal)} tone="coral" sub={`${buckets.overdue.length} customers`} />
      </div>

      <h3 className="font-display text-base font-semibold mb-2.5">Recovery</h3>
      <div className="flex gap-3 flex-wrap mb-4">
        {(["overdue", "today", "week", "month"]).map((k) => (
          <div key={k} className="text-center flex-1 min-w-[130px] border border-line rounded-2xl py-4">
            <div className={`font-mono-num font-bold text-2xl ${k === "overdue" ? "text-coral" : "text-aqua"}`}>{buckets[k].length}</div>
            <div className="text-xs text-slate mt-1">{BUCKET_LABEL[k]} due</div>
            <div className="text-[10.5px] text-slate mt-0.5">{pkr(bucketSum(buckets[k]))}</div>
          </div>
        ))}
      </div>
      {actionable.length > 0 && (
        <div className="overflow-x-auto border border-line rounded-2xl mb-6">
          <table className="w-full text-[13.5px] border-collapse">
            <thead><tr className="bg-foam"><Th>Customer</Th><Th>Amount Due</Th><Th>Due Date</Th><Th>Frequency</Th><Th>Last Payment</Th><Th>Status</Th></tr></thead>
            <tbody>
              {actionable.map((d) => (
                <tr key={d.customerId} className="hover:bg-foam">
                  <Td><Link href={`/customers/${d.customerId}`} className="font-semibold text-navy hover:text-aqua">{d.name}</Link></Td>
                  <Td className="text-coral font-semibold">{pkr(d.balance)}</Td>
                  <Td>{d.dueDate ? fmtDate(d.dueDate.toISOString()) : "—"}</Td>
                  <Td>{d.freq}</Td>
                  <Td>{d.lastPayment ? fmtDate(d.lastPayment) : "never"}</Td>
                  <Td><Badge text={BUCKET_LABEL[d.bucket]} tone={BUCKET_TONE[d.bucket]} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate mb-6">Due dates are estimated from each customer&apos;s payment frequency and last payment date — not a stored due-date field.</p>

      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Phone (or Name), Amount, Date, Method"
          action={bulkImportPayments}
          sampleRow={{ Phone: "03001234567", Name: "Ali Traders", Amount: 1000, Date: "2026-08-31", Method: "Cash" }}
          previewType="payments"
        />
        <ExportExcelButton rows={exportRows} filename="evergreen-payments.xlsx" sheetName="Payments" />
        <PrintButton />
        <AddPaymentForm
          customers={(balances || []).map((b) => ({ id: b.customer_id, name: b.name, balance: b.balance, frequency: freqMap[b.customer_id] }))}
          collectors={collectors || []}
          initialCustomerId={sp.customer || ""}
        />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Customer</Th><Th>Amount</Th><Th>Method</Th><Th>Collected By</Th><Th>Reference</Th></tr></thead>
          <tbody>
            {(payments || []).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No payments yet.</td></tr>}
            {(payments || []).map((p) => (
              <tr key={p.id} className="hover:bg-foam"><Td>{fmtDate(p.payment_date)}</Td><Td>{p.customers?.name}</Td><Td>{pkr(p.amount)}</Td><Td>{p.method}</Td><Td>{p.profiles?.full_name || "—"}</Td><Td className="text-slate">{p.reference || "—"}</Td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
