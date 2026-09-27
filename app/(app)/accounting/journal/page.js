import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { Th, Td, Badge, DocumentActionBar } from "@/components/ui";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import { voidJournalEntry } from "@/app/actions";
import ListFilterBar from "@/components/ListFilterBar";
import Pager from "@/components/Pager";
import { pageFrom, rangeFor } from "@/lib/listParams";
import { applyJournalFilters } from "@/lib/listQueries";
import { exportJournalRows } from "@/lib/exportActions";
import { getBrandingLite } from "@/lib/pdf/business";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Only a genuinely standalone/orphaned entry can be voided directly —
// anything tied to an expense/payment/invoice/delivery (or that's already
// a reversal itself) is refused by fn_void_journal_entry, so there's no
// point showing the button for those; void the source record instead.
const SOURCED_MODULES = ["expenses", "payments", "invoices", "deliveries", "journal_void"];

export default async function JournalPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || "").trim();
  const dateFrom = sp.from || "";
  const dateTo = sp.to || "";
  const supabase = await createClient();

  const filters = { q, from: dateFrom, to: dateTo };
  const page = pageFrom(sp);
  const [from, to] = rangeFor(page, PAGE_SIZE);

  const [{ data: entries, count }, { data: canVoid }, branding] = await Promise.all([
    applyJournalFilters(supabase.from("journal_entries").select("*, journal_lines(*, chart_of_accounts(code, name))", { count: "exact" }), filters)
      .order("entry_date", { ascending: false }).order("created_at", { ascending: false }).order("id").range(from, to),
    supabase.rpc("fn_has_permission", { perm_key: "journal.delete" }),
    getBrandingLite(supabase),
  ]);
  // Only this page's entries need their "Voided" flag: look up reversals
  // pointing at them (independent of the search/date filter).
  const pageIds = (entries || []).map((e) => e.id);
  const { data: voidReversals } = pageIds.length
    ? await supabase.from("journal_entries").select("source_id").eq("source_module", "journal_void").in("source_id", pageIds)
    : { data: [] };
  const voidedSourceIds = new Set((voidReversals || []).map((r) => r.source_id));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Journal Entries</h2>
      <p className="text-slate text-sm mb-5">Double-entry postings generated automatically from sales, payments and expenses.</p>

      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-start">
        <ListFilterBar className="!mb-0" placeholder="Search entry #, reference, description…" dateFilters={[{ name: "from", label: "From" }, { name: "to", label: "To" }]} />
        <div className="flex-1" />
        <DocumentActionBar
          print
          excel={{ loadRows: exportJournalRows.bind(null, filters), sheetName: "Journal", reportTitle: "Journal Entries", branding }}
          share={{ title: "Journal Entries" }}
        />
      </div>
      <p className="no-print text-xs text-slate mb-2">{(count || 0).toLocaleString()} entries</p>

      <div className="flex flex-col gap-3">
        {(entries || []).length === 0 && (
          <div className="border border-line rounded-2xl p-6 text-center text-sm text-slate">
            {q || dateFrom || dateTo ? "No journal entries match this filter." : "No journal entries yet — they post automatically the moment you record a sale, payment, or expense."}
          </div>
        )}
        {(entries || []).map((je) => {
          const total = (je.journal_lines || []).reduce((a, l) => a + Number(l.debit), 0);
          const alreadyVoided = voidedSourceIds.has(je.id);
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
                  <DocumentActionBar compact pdfHref={`/api/pdf/journal-voucher/${je.id}`} pdfLabel="Voucher" />
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
      <Pager basePath="/accounting/journal" searchParams={sp} page={page} pageSize={PAGE_SIZE} total={count || 0} label="Journal pages" />
    </div>
  );
}
