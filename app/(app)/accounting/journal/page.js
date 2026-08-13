import { createClient } from "@/lib/supabase/server";
import { ExportExcelButton, PrintButton, Th, Td, pkr, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("*, journal_lines(debit, credit, chart_of_accounts(name, code))")
    .order("entry_date", { ascending: false })
    .limit(150);

  const exportRows = [];
  (entries || []).forEach((e) => {
    (e.journal_lines || []).forEach((l) => {
      exportRows.push({ Date: e.entry_date, Reference: e.reference, Description: e.description, Account: l.chart_of_accounts?.name, Debit: l.debit, Credit: l.credit });
    });
  });

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Journal Entries</h2>
      <p className="text-slate text-sm mb-5">Every entry here is auto-generated from a real sale, payment, or expense. Debits always equal credits.</p>
      <div className="no-print flex gap-2.5 mb-4">
        <ExportExcelButton rows={exportRows} filename="general-ledger.xlsx" sheetName="Journal" />
        <PrintButton />
      </div>
      <div className="flex flex-col gap-3">
        {(entries || []).length === 0 && <p className="text-sm text-slate">No journal entries yet — record a sale, payment, or expense to see double-entry postings here.</p>}
        {(entries || []).map((e) => {
          const totalDebit = (e.journal_lines || []).reduce((a, l) => a + Number(l.debit), 0);
          return (
            <div key={e.id} className="border border-line rounded-xl p-4">
              <div className="flex justify-between text-xs text-slate mb-2">
                <span>{fmtDate(e.entry_date)} · <strong className="text-ink">{e.reference}</strong> · {e.description}</span>
                <span className="font-mono-num">{pkr(totalDebit)}</span>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {(e.journal_lines || []).map((l, i) => (
                    <tr key={i}>
                      <td className="py-0.5">{l.chart_of_accounts?.name}</td>
                      <td className="py-0.5 text-right w-24">{l.debit > 0 ? pkr(l.debit) : ""}</td>
                      <td className="py-0.5 text-right w-24">{l.credit > 0 ? pkr(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
