import { createClient } from "@/lib/supabase/server";
import { ExportExcelButton, PrintButton, Th, Td, pkr } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TrialBalancePage({ searchParams }) {
  const supabase = await createClient();
  const from = searchParams?.from;
  const to = searchParams?.to;

  let q = supabase.from("journal_lines").select("debit, credit, chart_of_accounts(id, code, name, type), journal_entries!inner(entry_date)");
  if (from) q = q.gte("journal_entries.entry_date", from);
  if (to) q = q.lte("journal_entries.entry_date", to);
  const { data: lines } = await q;

  const byAccount = {};
  (lines || []).forEach((l) => {
    const acc = l.chart_of_accounts;
    if (!acc) return;
    byAccount[acc.id] = byAccount[acc.id] || { code: acc.code, name: acc.name, type: acc.type, debit: 0, credit: 0 };
    byAccount[acc.id].debit += Number(l.debit);
    byAccount[acc.id].credit += Number(l.credit);
  });
  const rows = Object.values(byAccount).sort((a, b) => a.code.localeCompare(b.code));
  const totalDebit = rows.reduce((a, r) => a + r.debit, 0);
  const totalCredit = rows.reduce((a, r) => a + r.credit, 0);
  const exportRows = rows.map((r) => ({ Code: r.code, Account: r.name, Debit: r.debit, Credit: r.credit }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Trial Balance</h2>
      <p className="text-slate text-sm mb-5">{from || to ? `${from || "start"} → ${to || "today"}` : "All time"} — totals must balance.</p>
      <form className="no-print flex flex-wrap gap-2.5 mb-4 items-end">
        <label className="text-xs font-semibold text-slate">From<br /><input type="date" name="from" defaultValue={from} className="mt-1 px-2.5 py-2 rounded-lg border border-line text-sm" /></label>
        <label className="text-xs font-semibold text-slate">To<br /><input type="date" name="to" defaultValue={to} className="mt-1 px-2.5 py-2 rounded-lg border border-line text-sm" /></label>
        <button className="px-3.5 py-2 rounded-lg bg-navy text-white text-xs font-semibold">Apply</button>
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="trial-balance.xlsx" sheetName="Trial Balance" />
        <PrintButton />
      </form>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Code</Th><Th>Account</Th><Th>Debit</Th><Th>Credit</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="hover:bg-foam"><Td className="font-mono-num">{r.code}</Td><Td className="font-semibold">{r.name}</Td>
                <Td>{r.debit > 0 ? pkr(r.debit) : "—"}</Td><Td>{r.credit > 0 ? pkr(r.credit) : "—"}</Td></tr>
            ))}
            <tr className="bg-foam font-bold"><Td colSpan={2}>TOTAL</Td><Td>{pkr(totalDebit)}</Td><Td>{pkr(totalCredit)}</Td></tr>
          </tbody>
        </table>
      </div>
      <p className={`text-sm mt-3 font-semibold ${Math.round(totalDebit) === Math.round(totalCredit) ? "text-green" : "text-coral"}`}>
        {Math.round(totalDebit) === Math.round(totalCredit) ? "✓ Balanced" : "⚠ Out of balance — this should never happen; check for a failed trigger."}
      </p>
    </div>
  );
}
