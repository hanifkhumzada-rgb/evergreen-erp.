import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { PrintButton, ExportExcelButton, Th, Td } from "@/components/ui";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";

export const dynamic = "force-dynamic";

export default async function TrialBalancePage() {
  const supabase = await createClient();
  const [branding, { data: rows }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("v_trial_balance").select("*").order("code"),
  ]);

  const totalDebit = (rows || []).reduce((a, r) => a + Number(r.total_debit), 0);
  const totalCredit = (rows || []).reduce((a, r) => a + Number(r.total_credit), 0);
  const exportRows = (rows || []).map((r) => ({ Code: r.code, Account: r.name, Type: r.type, Debit: r.total_debit, Credit: r.total_credit, Balance: r.balance }));

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Trial Balance" meta={`Generated ${fmtDate(new Date().toISOString())}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Trial Balance</h2>
      <p className="no-print text-slate text-sm mb-5">Every account&apos;s total debits and credits, calculated live from posted journal entries.</p>

      <div className="no-print flex gap-2.5 mb-3">
        <ExportExcelButton rows={exportRows} sheetName="Trial Balance" reportTitle="Trial Balance" branding={branding} />
        <PrintButton />
      </div>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Code</Th><Th>Account</Th><Th>Debit</Th><Th>Credit</Th></tr></thead>
          <tbody>
            {(rows || []).length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate">No postings yet.</td></tr>}
            {(rows || []).filter((r) => Number(r.total_debit) > 0 || Number(r.total_credit) > 0).map((r) => (
              <tr key={r.account_id} className="hover:bg-foam">
                <Td className="font-mono-num text-xs">{r.code}</Td>
                <Td className="font-semibold">{r.name}</Td>
                <Td>{Number(r.total_debit) > 0 ? pkr(r.total_debit) : ""}</Td>
                <Td>{Number(r.total_credit) > 0 ? pkr(r.total_credit) : ""}</Td>
              </tr>
            ))}
          </tbody>
          {(rows || []).length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ink font-bold">
                <Td colSpan={2}>Total</Td>
                <Td>{pkr(totalDebit)}</Td>
                <Td>{pkr(totalCredit)}</Td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-slate mt-3">
        {Math.abs(totalDebit - totalCredit) < 1
          ? "✓ Balanced — total debits equal total credits."
          : `⚠ Out of balance by ${pkr(Math.abs(totalDebit - totalCredit))} — this should not happen; check recent journal entries.`}
      </p>
      <DocumentPrintFooter />
    </div>
  );
}
