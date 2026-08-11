import { createClient } from "@/lib/supabase/server";
import { PrintButton, pkr } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BalanceSheetPage({ searchParams }) {
  const supabase = createClient();
  const asOf = searchParams?.asOf || new Date().toISOString().slice(0, 10);

  const { data: lines } = await supabase
    .from("journal_lines")
    .select("debit, credit, chart_of_accounts(name, type), journal_entries!inner(entry_date)")
    .lte("journal_entries.entry_date", asOf);

  const byType = (type, natural) => {
    const m = {};
    (lines || []).filter((l) => l.chart_of_accounts?.type === type).forEach((l) => {
      const n = l.chart_of_accounts.name;
      const delta = natural === "debit" ? Number(l.debit) - Number(l.credit) : Number(l.credit) - Number(l.debit);
      m[n] = (m[n] || 0) + delta;
    });
    return Object.entries(m).filter(([, v]) => Math.round(v) !== 0);
  };

  const assets = byType("ASSET", "debit");
  const liabilities = byType("LIABILITY", "credit");
  const equity = byType("EQUITY", "credit");

  const income = (lines || []).filter((l) => l.chart_of_accounts?.type === "INCOME").reduce((a, l) => a + Number(l.credit) - Number(l.debit), 0);
  const cogs = (lines || []).filter((l) => l.chart_of_accounts?.type === "COGS").reduce((a, l) => a + Number(l.debit) - Number(l.credit), 0);
  const expense = (lines || []).filter((l) => l.chart_of_accounts?.type === "EXPENSE").reduce((a, l) => a + Number(l.debit) - Number(l.credit), 0);
  const currentEarnings = income - cogs - expense;

  const totalAssets = assets.reduce((a, [, v]) => a + v, 0);
  const totalLiabilities = liabilities.reduce((a, [, v]) => a + v, 0);
  const totalEquity = equity.reduce((a, [, v]) => a + v, 0) + currentEarnings;

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Balance Sheet</h2>
      <form className="no-print flex flex-wrap gap-2.5 mb-5 items-end">
        <label className="text-xs font-semibold text-slate">As of<br /><input type="date" name="asOf" defaultValue={asOf} className="mt-1 px-2.5 py-2 rounded-lg border border-line text-sm" /></label>
        <button className="px-3.5 py-2 rounded-lg bg-navy text-white text-xs font-semibold">Apply</button>
        <div className="flex-1" /><PrintButton />
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <div className="border border-line rounded-2xl p-5">
          <h4 className="font-bold text-sm mb-3">Assets</h4>
          {assets.map(([n, v]) => <div key={n} className="flex justify-between text-[13px] py-1"><span>{n}</span><span>{pkr(v)}</span></div>)}
          <div className="flex justify-between font-bold text-sm pt-2 mt-2 border-t-2 border-ink"><span>Total Assets</span><span>{pkr(totalAssets)}</span></div>
        </div>
        <div className="border border-line rounded-2xl p-5">
          <h4 className="font-bold text-sm mb-3">Liabilities</h4>
          {liabilities.map(([n, v]) => <div key={n} className="flex justify-between text-[13px] py-1"><span>{n}</span><span>{pkr(v)}</span></div>)}
          {liabilities.length === 0 && <div className="text-xs text-slate">None recorded.</div>}
          <div className="flex justify-between font-bold text-sm pt-2 mt-2 border-t border-line"><span>Total Liabilities</span><span>{pkr(totalLiabilities)}</span></div>

          <h4 className="font-bold text-sm mt-4 mb-3">Equity</h4>
          {equity.map(([n, v]) => <div key={n} className="flex justify-between text-[13px] py-1"><span>{n}</span><span>{pkr(v)}</span></div>)}
          <div className="flex justify-between text-[13px] py-1"><span>Current Period Earnings</span><span>{pkr(currentEarnings)}</span></div>
          <div className="flex justify-between font-bold text-sm pt-2 mt-2 border-t border-line"><span>Total Equity</span><span>{pkr(totalEquity)}</span></div>

          <div className="flex justify-between font-bold text-sm pt-2 mt-2 border-t-2 border-ink"><span>Total Liabilities + Equity</span><span>{pkr(totalLiabilities + totalEquity)}</span></div>
        </div>
      </div>
      <p className={`text-sm mt-3 font-semibold ${Math.round(totalAssets) === Math.round(totalLiabilities + totalEquity) ? "text-green" : "text-coral"}`}>
        {Math.round(totalAssets) === Math.round(totalLiabilities + totalEquity) ? "✓ Assets = Liabilities + Equity" : "⚠ Does not balance — check for missing account mappings."}
      </p>
    </div>
  );
}
