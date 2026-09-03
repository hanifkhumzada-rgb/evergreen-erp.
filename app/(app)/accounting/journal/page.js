import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { Th, Td, Badge } from "@/components/ui";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import { voidJournalEntry } from "@/app/actions";

export const dynamic = "force-dynamic";

// Only a genuinely standalone/orphaned entry can be voided directly —
// anything tied to an expense/payment/invoice/delivery (or that's already
// a reversal itself) is refused by fn_void_journal_entry, so there's no
// point showing the button for those; void the source record instead.
const SOURCED_MODULES = ["expenses", "payments", "invoices", "deliveries", "journal_void"];

export default async function JournalPage() {
  const supabase = await createClient();
  const [{ data: entries }, { data: canVoid }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("*, journal_lines(*, chart_of_accounts(code, name))")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.rpc("fn_has_permission", { perm_key: "journal.delete" }),
  ]);

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
          const alreadyVoided = (entries || []).some((e) => e.source_module === "journal_void" && e.source_id === je.id);
          const canVoidThis = canVoid && !SOURCED_MODULES.includes(je.source_module) && !alreadyVoided;
          return (
            <div key={je.id} className="border border-line rounded-2xl overflow-hidden">
              <div className="flex justify-between items-center px-4 py-3 bg-foam">
                <div>
                  <span className="font-semibold text-[13.5px]">{je.entry_no}</span>
                  <span className="text-slate text-xs ml-2">{fmtDate(je.entry_date)}</span>
                  {je.reference && <span className="text-slate text-xs ml-2">· {je.reference}</span>}
                  {je.source_module === "journal_void" && <span className="ml-2"><Badge text="Reversal" tone="slate" /></span>}
                  {alreadyVoided && <span className="ml-2"><Badge text="Voided" tone="coral" /></span>}
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono-num text-xs text-slate">{pkr(total)}</span>
                  {canVoidThis && (
                    <ReasonConfirmButton action={voidJournalEntry} id={je.id} label="Void"
                      confirmText={`Void journal entry ${je.entry_no}?`}
                      detailText="This can't be undone. Posts a new entry with every line's debit/credit reversed — the original stays for the audit trail."
                      confirmLabel="Confirm Void" busyLabel="Voiding…" />
                  )}
                </div>
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
