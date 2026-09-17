import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { DocumentActionBar } from "@/components/ui";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";

export const dynamic = "force-dynamic";

export default async function BalanceSheetPage() {
  const supabase = await createClient();
  const [branding, { data: rows }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("v_trial_balance").select("*").order("code"),
  ]);

  const assets = (rows || []).filter((r) => r.type === "asset" && Number(r.balance) !== 0);
  const liabilities = (rows || []).filter((r) => r.type === "liability" && Number(r.balance) !== 0);
  const equity = (rows || []).filter((r) => r.type === "equity" && Number(r.balance) !== 0);
  // Income/expense derived from the same trial-balance rows already
  // fetched above, instead of two separate unbounded "every invoice/every
  // expense ever" queries — income accounts are credit-normal (negative
  // balance here, same convention as liabilities/equity below), expense
  // and cogs accounts are debit-normal like assets, so no negation.
  const income = (rows || []).filter((r) => r.type === "income").reduce((a, r) => a - Number(r.balance), 0);
  const opex = (rows || []).filter((r) => r.type === "expense" || r.type === "cogs").reduce((a, r) => a + Number(r.balance), 0);
  const netProfit = income - opex;

  const totalAssets = assets.reduce((a, r) => a + Number(r.balance), 0);
  const totalLiabilities = liabilities.reduce((a, r) => a - Number(r.balance), 0);
  const totalEquity = equity.reduce((a, r) => a - Number(r.balance), 0) + netProfit;

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Balance Sheet" meta={`As of ${fmtDate(new Date().toISOString())}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Balance Sheet</h2>
      <p className="no-print text-slate text-sm mb-5">Assets, liabilities and equity as of today — calculated live from posted journal entries.</p>
      <div className="no-print mb-3">
        <DocumentActionBar
          print
          excel={{
            rows: [
              ...assets.map((a) => ({ Section: "Asset", Account: a.name, Amount: a.balance })),
              ...liabilities.map((a) => ({ Section: "Liability", Account: a.name, Amount: -a.balance })),
              ...equity.map((a) => ({ Section: "Equity", Account: a.name, Amount: -a.balance })),
              { Section: "Equity", Account: "Retained Earnings (current)", Amount: netProfit },
            ],
            sheetName: "Balance Sheet",
            reportTitle: "Balance Sheet",
            branding,
          }}
          share={{ title: "Balance Sheet" }}
        />
      </div>

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
      <DocumentPrintFooter />
    </div>
  );
}
