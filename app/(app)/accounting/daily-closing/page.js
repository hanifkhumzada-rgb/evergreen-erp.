import { createClient } from "@/lib/supabase/server";
import CloseDayForm from "@/components/CloseDayForm";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, Th, Td, KPI } from "@/components/ui";

export const dynamic = "force-dynamic";
function todayISO() { return new Date().toISOString().slice(0, 10); }

function parseClosing(txn) {
  let summary = {};
  try { summary = JSON.parse(txn.description); } catch {}
  return {
    id: txn.id,
    close_date: txn.txn_date,
    opening_cash: summary.opening_cash ?? 0,
    collections_total: summary.collections_total ?? 0,
    expenses_total: summary.expenses_total ?? 0,
    expected_cash: summary.expected_cash ?? 0,
    actual_cash: summary.actual_cash ?? 0,
    difference: Number(txn.amount),
  };
}

export default async function DailyClosingPage() {
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: txns }, { data: todayPayments }, { data: todayExpenses }] = await Promise.all([
    supabase.from("cash_transactions").select("*").eq("reference_type", "daily_closing").order("txn_date", { ascending: false }).limit(30),
    supabase.from("payments").select("amount").eq("payment_date", today).eq("voided", false),
    supabase.from("expenses").select("amount").eq("expense_date", today).in("status", ["approved", "paid"]),
  ]);
  const closings = (txns || []).map(parseClosing);
  const lastClosing = closings?.[0];
  const defaultOpening = lastClosing ? Number(lastClosing.actual_cash || lastClosing.expected_cash) : 0;
  const alreadyClosed = closings?.find((c) => c.close_date === today);
  const collectionsToday = (todayPayments || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const expensesToday = (todayExpenses || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const expectedToday = defaultOpening + collectionsToday - expensesToday;

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Daily Closing</h2>
      <p className="text-slate text-sm mb-5">Reconcile cash in hand against sales, collections and expenses for the day.</p>

      <div className="mb-5 flex flex-wrap gap-3.5">
        <KPI label="OPENING CASH" value={pkr(defaultOpening)} tone="navy" />
        <KPI label="COLLECTIONS" value={pkr(collectionsToday)} tone="green" />
        <KPI label="EXPENSES" value={pkr(expensesToday)} tone="amber" />
        <KPI label="EXPECTED CASH" value={pkr(expectedToday)} tone="aqua" sub="opening + collections − expenses" />
      </div>

      {alreadyClosed ? (
        <div className="border border-line rounded-2xl p-5 max-w-md">
          <Badge text="Already closed today" tone="green" />
          <div className="mt-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Expected cash</span><span>{pkr(alreadyClosed.expected_cash)}</span></div>
            <div className="flex justify-between"><span>Actual cash</span><span>{pkr(alreadyClosed.actual_cash)}</span></div>
            <div className={`flex justify-between font-bold ${Math.abs(alreadyClosed.difference) < 1 ? "text-green" : "text-coral"}`}><span>Difference</span><span>{pkr(alreadyClosed.difference)}</span></div>
          </div>
        </div>
      ) : (
        <CloseDayForm today={today} defaultOpeningCash={defaultOpening} />
      )}

      <h4 className="text-sm font-bold mt-8 mb-2.5">Closing history</h4>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Opening</Th><Th>Collections</Th><Th>Expenses</Th><Th>Expected</Th><Th>Actual</Th><Th>Difference</Th></tr></thead>
          <tbody>
            {(closings || []).length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate">No closings recorded yet.</td></tr>}
            {(closings || []).map((c) => (
              <tr key={c.id} className="hover:bg-foam">
                <Td>{fmtDate(c.close_date)}</Td><Td>{pkr(c.opening_cash)}</Td><Td>{pkr(c.collections_total)}</Td><Td>{pkr(c.expenses_total)}</Td>
                <Td>{pkr(c.expected_cash)}</Td><Td>{pkr(c.actual_cash)}</Td>
                <Td><span className={Math.abs(c.difference) < 1 ? "text-green font-semibold" : "text-coral font-semibold"}>{pkr(c.difference)}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
