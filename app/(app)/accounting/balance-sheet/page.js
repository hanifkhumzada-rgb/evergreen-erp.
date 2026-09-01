import { createClient } from "@/lib/supabase/server";
import { pkr } from "@/lib/format";
import { PrintButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BalanceSheetPage() {
  const supabase = await createClient();
  const [{ data: rows }, { data: invoices }, { data: expenses }] = await Promise.all([
    supabase.from("v_trial_balance").select("*").order("code"),
    supabase.from("invoices").select("net_amount").neq("status", "void"),
    supabase.from("expenses").select("amount").in("status", ["approved", "paid"]),
  ]);
  const income = (invoices || []).reduce((a, i) => a + Number(i.net_amount), 0);
  const opex = (expenses || []).reduce((a, e) => a + Number(e.amount), 0);
  const netProfit = income - opex;

  const assets = (rows || []).filter((r) => r.type === "asset" && Number(r.balance) !== 0);
  const liabilities = (rows || []).filter((r) => r.type === "liability" && Number(r.balance) !== 0);
  const equity = (rows || []).filter((r) => r.type === "equity" && Number(r.balance) !== 0);

  const totalAssets = assets.reduce((a, r) => a + Number(r.balance), 0);
  const totalLiabilities = liabilities.reduce((a, r) => a - Number(r.balance), 0);
  const totalEquity = equity.reduce((a, r) => a - Number(r.balance), 0) + netProfit;

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Balance Sheet</h2>
      <p className="text-slate text-sm mb-5">Assets, liabilities and equity as of today — calculated live from posted journal entries.</p>
      <div className="no-print mb-3"><PrintButton /></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-3xl">
        <div className="border border-line rounded-2xl p-5">
          <h4 className="text-sm font-bold mb-3">Assets</h4>
          {assets.length === 0 && <p className="text-xs text-slate">No asset postings yet.</p>}
          {assets.map((a) => (
            <div key={a.account_id} className="flex justify-between text-[13px] py-1">
              <span>{a.name}</span><span>{pkr(a.balance)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 mt-2 border-t-2 border-ink font-bold text-sm">
            <span>Total Assets</span><span>{pkr(totalAssets)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="border border-line rounded-2xl p-5">
            <h4 className="text-sm font-bold mb-3">Liabilities</h4>
            {liabilities.length === 0 && <p className="text-xs text-slate">No liability postings yet.</p>}
            {liabilities.map((a) => (
              <div key={a.account_id} className="flex justify-between text-[13px] py-1">
                <span>{a.name}</span><span>{pkr(-a.balance)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 mt-2 border-t-2 border-ink font-bold text-sm">
              <span>Total Liabilities</span><span>{pkr(totalLiabilities)}</span>
            </div>
          </div>

          <div className="border border-line rounded-2xl p-5">
            <h4 className="text-sm font-bold mb-3">Equity</h4>
            {equity.map((a) => (
              <div key={a.account_id} className="flex justify-between text-[13px] py-1">
                <span>{a.name}</span><span>{pkr(-a.balance)}</span>
              </div>
            ))}
            <div className="flex justify-between text-[13px] py-1">
              <span>Retained Earnings (current)</span><span>{pkr(netProfit)}</span>
            </div>
            <div className="flex justify-between pt-2 mt-2 border-t-2 border-ink font-bold text-sm">
              <span>Total Equity</span><span>{pkr(totalEquity)}</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate mt-4 max-w-3xl">
        {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1
          ? "✓ Balanced — Assets = Liabilities + Equity."
          : `Note: Assets (${pkr(totalAssets)}) vs Liabilities + Equity (${pkr(totalLiabilities + totalEquity)}) — small gaps are expected until Owner Capital / opening balances are recorded.`}
      </p>
    </div>
  );
}
