import { createClient } from "@/lib/supabase/server";
import { PrintButton, pkr } from "@/components/ui";

export const dynamic = "force-dynamic";
function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }

export default async function ProfitLossPage({ searchParams }) {
  const supabase = createClient();
  const from = searchParams?.from || monthStart();
  const to = searchParams?.to || new Date().toISOString().slice(0, 10);

  const { data: lines } = await supabase
    .from("journal_lines")
    .select("debit, credit, chart_of_accounts(name, type), journal_entries!inner(entry_date)")
    .gte("journal_entries.entry_date", from)
    .lte("journal_entries.entry_date", to);

  const sum = (type) => (lines || []).filter((l) => l.chart_of_accounts?.type === type)
    .reduce((a, l) => a + (type === "INCOME" ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit)), 0);
  const byName = (type) => {
    const m = {};
    (lines || []).filter((l) => l.chart_of_accounts?.type === type).forEach((l) => {
      const n = l.chart_of_accounts.name;
      m[n] = (m[n] || 0) + (type === "INCOME" ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit));
    });
    return Object.entries(m);
  };

  const income = sum("INCOME");
  const cogs = sum("COGS");
  const grossProfit = income - cogs;
  const opex = sum("EXPENSE");
  const netProfit = grossProfit - opex;

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Profit &amp; Loss</h2>
      <form className="no-print flex flex-wrap gap-2.5 mb-5 items-end">
        <label className="text-xs font-semibold text-slate">From<br /><input type="date" name="from" defaultValue={from} className="mt-1 px-2.5 py-2 rounded-lg border border-line text-sm" /></label>
        <label className="text-xs font-semibold text-slate">To<br /><input type="date" name="to" defaultValue={to} className="mt-1 px-2.5 py-2 rounded-lg border border-line text-sm" /></label>
        <button className="px-3.5 py-2 rounded-lg bg-navy text-white text-xs font-semibold">Apply</button>
        <div className="flex-1" /><PrintButton />
      </form>

      <div className="border border-line rounded-2xl p-6 max-w-lg">
        <Section title="Revenue" items={byName("INCOME")} total={income} />
        <Section title="Cost of Goods Sold" items={byName("COGS")} total={cogs} negative />
        <Row label="Gross Profit" value={grossProfit} bold />
        <div className="h-3" />
        <Section title="Operating Expenses" items={byName("EXPENSE")} total={opex} negative />
        <Row label="Net Profit" value={netProfit} bold big />
      </div>
      <p className="text-xs text-slate mt-3">Figures are calculated live from journal_entries / journal_lines — nothing here is hardcoded.</p>
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
