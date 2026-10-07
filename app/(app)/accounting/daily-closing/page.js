import Link from "next/link";
import { FileText, BarChart3 } from "lucide-react";
import { getCurrentProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import CloseDayForm from "@/components/CloseDayForm";
import ClosingReview from "@/components/ew/ClosingReview";
import { EwStatusBadge } from "@/components/ew/EwDoc";
import { pkr, fmtDate, fmtDateTime, todayPK } from "@/lib/format";
import { Th, Td, KPI } from "@/components/ui";
import { computeDaySummary, expectedCash, openingCashFor } from "@/lib/ew/closing";

export const dynamic = "force-dynamic";

// Legacy closings (before the daily_closings table) live in cash_transactions
// with a JSON description — still listed so no history disappears.
function parseLegacy(txn) {
  let s = {};
  try { s = JSON.parse(txn.description); } catch { /* ignore */ }
  return { id: txn.id, legacy: true, close_date: txn.txn_date, opening_cash: s.opening_cash ?? 0, collections_total: s.collections_total ?? 0, expenses_total: s.expenses_total ?? 0, expected_cash: s.expected_cash ?? 0, actual_cash: s.actual_cash ?? 0, difference: Number(txn.amount), status: "closed" };
}

export default async function DailyClosingPage() {
  const { roleKey } = await getCurrentProfile();
  const supabase = await createClient();
  const today = todayPK();
  const [{ data: closings }, { data: legacyTxns }, summary, opening] = await Promise.all([
    supabase.from("daily_closings").select("*, closer:profiles!daily_closings_closed_by_fkey(full_name), approver:profiles!daily_closings_approved_by_fkey(full_name)").order("close_date", { ascending: false }).limit(60),
    supabase.from("cash_transactions").select("id, txn_date, amount, description, reference_id").eq("reference_type", "daily_closing").order("txn_date", { ascending: false }).limit(60),
    computeDaySummary(supabase, today),
    openingCashFor(supabase, today),
  ]);
  const newIds = new Set((closings || []).map((c) => c.id));
  const legacy = (legacyTxns || []).filter((t) => !t.reference_id || !newIds.has(t.reference_id)).map(parseLegacy);
  const history = [...(closings || []), ...legacy].sort((a, b) => (a.close_date < b.close_date ? 1 : -1));
  const todayClosing = history.find((c) => c.close_date === today);
  const expected = expectedCash(opening, summary);
  const canReview = ["owner", "admin"].includes(roleKey);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold mb-1">Daily Closing</h2>
          <p className="text-slate text-sm">Count the cash box and close the day. Expected cash = opening cash + cash collections − cash expenses.</p>
        </div>
        <Link href="/reports/daily-closing" className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold hover:border-aqua/40 hover:text-aqua"><BarChart3 size={14} /> Daily Closing Report</Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-3.5">
        <KPI label="OPENING CASH" value={pkr(opening)} tone="navy" sub="previous closing's counted cash" />
        <KPI label="SALES TODAY" value={pkr(summary.sales)} tone="aqua" sub={`${summary.invoices} invoices`} />
        <KPI label="COLLECTIONS" value={pkr(summary.collections)} tone="green" sub={`${pkr(summary.cashCollections)} in cash`} />
        <KPI label="EXPENSES" value={pkr(summary.expenses)} tone="amber" sub={`${pkr(summary.cashExpenses)} paid in cash`} />
        <KPI label="EXPECTED CASH" value={pkr(expected)} tone="slate" sub="opening + cash in − cash out" />
      </div>

      {todayClosing ? (
        <div className="max-w-md rounded-2xl border border-line bg-card p-5">
          <div className="flex items-center justify-between gap-2"><EwStatusBadge status={todayClosing.status} label={`Today ${todayClosing.status === "closed" ? "closed — awaiting approval" : todayClosing.status}`} />{!todayClosing.legacy ? <Link href={`/accounting/daily-closing/${todayClosing.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-aqua"><FileText size={13} /> View Statement</Link> : null}</div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Expected cash</span><span>{pkr(todayClosing.expected_cash)}</span></div>
            <div className="flex justify-between"><span>Actual cash</span><span>{pkr(todayClosing.actual_cash)}</span></div>
            <div className={`flex justify-between font-bold ${Math.abs(todayClosing.difference) < 1 ? "text-green" : "text-coral"}`}><span>Difference</span><span>{pkr(todayClosing.difference)}</span></div>
          </div>
        </div>
      ) : (
        <CloseDayForm today={today} defaultOpeningCash={opening} expectedCash={expected} />
      )}

      <h4 className="mb-2.5 mt-8 text-sm font-bold">Closing history</h4>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full border-collapse text-[13.5px]">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Closing #</Th><Th>Opening</Th><Th>Collections</Th><Th>Expenses</Th><Th>Expected</Th><Th>Actual</Th><Th>Difference</Th><Th>Status</Th><Th>Closed / Approved</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {history.length === 0 && <tr><td colSpan={11} className="py-8 text-center text-slate">No closings recorded yet.</td></tr>}
            {history.map((c) => (
              <tr key={c.id} className="hover:bg-foam">
                <Td>{fmtDate(c.close_date)}</Td><Td className="font-mono-num text-xs">{c.closing_no || "Legacy"}</Td>
                <Td>{pkr(c.opening_cash)}</Td><Td>{pkr(c.collections_total)}</Td><Td>{pkr(c.expenses_total)}</Td>
                <Td>{pkr(c.expected_cash)}</Td><Td>{pkr(c.actual_cash)}</Td>
                <Td><span className={Math.abs(c.difference) < 1 ? "font-semibold text-green" : "font-semibold text-coral"}>{pkr(c.difference)}</span></Td>
                <Td><EwStatusBadge status={c.status} label={c.status === "closed" ? "Pending Approval" : undefined} /></Td>
                <Td className="text-xs text-slate">{c.closer?.full_name ? `${c.closer.full_name} · ${fmtDateTime(c.closed_at)}` : "—"}{c.approver?.full_name ? <div>{c.status === "rejected" ? "Rejected" : "Approved"} by {c.approver.full_name}</div> : null}</Td>
                <Td>
                  {c.legacy ? <span className="text-xs text-slate">—</span> : (
                    <span className="flex flex-wrap items-center gap-2">
                      <Link href={`/accounting/daily-closing/${c.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-aqua"><FileText size={13} /> Statement</Link>
                      {canReview && c.status === "closed" ? <ClosingReview id={c.id} /> : null}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
