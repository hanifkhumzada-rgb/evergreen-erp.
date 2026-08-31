import { createClient } from "@/lib/supabase/server";
import { Th, Td, pkr, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("*, journal_lines(*, chart_of_accounts(code, name))")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Journal Entries</h2>
      <p className="text-slate text-sm mb-5">Double-entry postings generated automatically from sales, payments and expenses.</p>

      <div className="flex flex-col gap-3">
        {(entries || []).length === 0 && (
          <div className="border border-line rounded-2xl p-6 text-center text-sm text-slate">
            No journal entries yet — they post automatically the moment you record a sale, payment, or expense.
          </div>
        )}
        {(entries || []).map((je) => {
          const total = (je.journal_lines || []).reduce((a, l) => a + Number(l.debit), 0);
          return (
            <div key={je.id} className="border border-line rounded-2xl overflow-hidden">
              <div className="flex justify-between items-center px-4 py-3 bg-foam">
                <div>
                  <span className="font-semibold text-[13.5px]">{je.entry_no}</span>
                  <span className="text-slate text-xs ml-2">{fmtDate(je.entry_date)}</span>
                  {je.reference && <span className="text-slate text-xs ml-2">· {je.reference}</span>}
                </div>
                <span className="font-mono-num text-xs text-slate">{pkr(total)}</span>
              </div>
              <table className="w-full text-[13px] border-collapse">
                <thead><tr><Th>Account</Th><Th>Debit</Th><Th>Credit</Th></tr></thead>
                <tbody>
                  {(je.journal_lines || []).map((l) => (
                    <tr key={l.id}>
                      <Td>{l.chart_of_accounts?.code} — {l.chart_of_accounts?.name}</Td>
                      <Td>{Number(l.debit) > 0 ? pkr(l.debit) : ""}</Td>
                      <Td>{Number(l.credit) > 0 ? pkr(l.credit) : ""}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {je.description && <div className="px-4 py-2 text-xs text-slate border-t border-line">{je.description}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
