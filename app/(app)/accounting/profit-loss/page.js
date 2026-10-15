import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { DocumentActionBar } from "@/components/ui";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import FinanceNav from "@/components/FinanceNav";

export const dynamic = "force-dynamic";
function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }

export default async function ProfitLossPage({ searchParams }) {
  const supabase = await createClient();
  const from = searchParams?.from || monthStart();
  const to = searchParams?.to || new Date().toISOString().slice(0, 10);

  const [branding, { data: lines }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("journal_lines").select("debit,credit,chart_of_accounts!inner(code,name,type),journal_entries!inner(entry_date,status)").eq("journal_entries.status", "posted").gte("journal_entries.entry_date", from).lte("journal_entries.entry_date", to),
  ]);
  const amountFor = (types) => (lines || []).filter(l => types.includes(l.chart_of_accounts?.type)).reduce((sum,l) => sum + (types.includes("income") ? Number(l.credit)-Number(l.debit) : Number(l.debit)-Number(l.credit)), 0);
  const income = amountFor(["income"]);
  const cogs = amountFor(["cogs"]);
  const grossProfit = income - cogs;
  const opex = amountFor(["expense"]);
  const netProfit = grossProfit - opex;
  const byExpenseCategory = () => {
    const m = {};
    (lines || []).filter(l => l.chart_of_accounts?.type === "expense").forEach((e) => { const n = e.chart_of_accounts?.name || "Other Expenses"; m[n] = (m[n] || 0) + Number(e.debit)-Number(e.credit); });
    return Object.entries(m);
  };
  const accountBreakdown = (type) => {
    const m = {};
    (lines || []).filter(l => l.chart_of_accounts?.type === type).forEach(l => {
      const n = l.chart_of_accounts?.name || "Other";
      const amount = type === "income" ? Number(l.credit)-Number(l.debit) : Number(l.debit)-Number(l.credit);
      m[n] = (m[n] || 0) + amount;
    });
    return Object.entries(m);
  };
  const byName = (type) => type === "INCOME" ? accountBreakdown("income") : type === "COGS" ? accountBreakdown("cogs") : type === "EXPENSE" ? byExpenseCategory() : [];

  return (
    <div>
      <FinanceNav current="/accounting/profit-loss" />
      <DocumentPrintHeader branding={branding} title="Profit & Loss" meta={`${fmtDate(from)} – ${fmtDate(to)}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Profit &amp; Loss</h2>
      <form className="no-print flex flex-wrap gap-2.5 mb-2 items-end">
        <label className="text-xs font-semibold text-slate">From<br /><input type="date" name="from" defaultValue={from} className="mt-1 px-2.5 py-2 rounded-lg border border-line bg-card text-ink text-sm" /></label>
        <label className="text-xs font-semibold text-slate">To<br /><input type="date" name="to" defaultValue={to} className="mt-1 px-2.5 py-2 rounded-lg border border-line bg-card text-ink text-sm" /></label>
        <button type="submit" className="px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold">Apply</button>
      </form>
      {/* Sibling <div> — DocumentActionBar's buttons are plain onClick
          handlers, never meant to submit the date-range form above (same
          bug class as /customers' "New Customer"). */}
      <div className="no-print flex justify-end mb-3">
        <DocumentActionBar print excel={{ rows: [...byName("INCOME").map(([Account,Amount])=>({Section:"Revenue",Account,Amount})),...byName("COGS").map(([Account,Amount])=>({Section:"Cost of Goods Sold",Account,Amount})),...byExpenseCategory().map(([Account,Amount])=>({Section:"Expense",Account,Amount}))], sheetName:"Profit and Loss", reportTitle:"Profit & Loss", branding }} share={{ title: "Profit & Loss" }} />
      </div>

      <div className="border border-line rounded-2xl p-6 max-w-lg">
        <Section title="Revenue" items={byName("INCOME")} total={income} />
        <Section title="Cost of Goods Sold" items={byName("COGS")} total={cogs} negative />
        <Row label="Gross Profit" value={grossProfit} bold />
        <div className="h-3" />
        <Section title="Operating Expenses" items={byName("EXPENSE")} total={opex} negative />
        <Row label="Net Profit" value={netProfit} bold big />
      </div>
      <p className="text-xs text-slate mt-3">Figures come only from posted journal lines in the selected period. Draft, rejected and reversed source records are excluded from the report.</p>
      <DocumentPrintFooter />
    </div>
  );
}
function Section({ title, items, total, negative }) {
  return (
    <div className="mb-3">
      <div className="font-bold text-sm mb-1.5">{title}</div>
      {items.length === 0 && <div className="text-xs text-slate pl-2">No entries in this period.</div>}
      {items.map(([name, val]) => <div key={name} className="flex justify-between text-[13px] pl-2 py-0.5"><span>{name}</span><span>{pkr(val)}</span></div>)}
      <div className="flex justify-between text-[13px] pl-2 pt-1 border-t border-line font-semibold"><span>Total {title}</span><span>{negative ? "(" + pkr(total) + ")" : pkr(total)}</span></div>
    </div>
  );
}
function Row({ label, value, bold, big }) {
  return (
    <div className={`flex justify-between py-2 border-t-2 border-ink ${bold ? "font-bold" : ""} ${big ? "text-lg text-aqua" : "text-sm"}`}>
      <span>{label}</span><span>{pkr(value)}</span>
    </div>
  );
}
