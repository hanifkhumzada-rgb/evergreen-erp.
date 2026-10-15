import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { DocumentActionBar, Th, Td } from "@/components/ui";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import Link from "next/link";
import FinanceNav from "@/components/FinanceNav";

export const dynamic = "force-dynamic";

export default async function TrialBalancePage({ searchParams }) {
  const sp = (await searchParams) || {};
  const from = sp.from || ""; const to = sp.to || new Date().toISOString().slice(0,10); const account = sp.account || "";
  const supabase = await createClient();
  const [branding, { data: accounts }, { data: lines }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("chart_of_accounts").select("id,code,name,type").eq("is_active",true).order("code"),
    supabase.from("journal_lines").select("account_id,debit,credit,journal_entries!inner(entry_date,status)").eq("journal_entries.status","posted").lte("journal_entries.entry_date",to).limit(10000),
  ]);
  const rows = (accounts || []).filter(a=>!account||a.id===account).map(a=>{const all=(lines||[]).filter(l=>l.account_id===a.id);const opening=all.filter(l=>from&&l.journal_entries.entry_date<from).reduce((n,l)=>n+Number(l.debit)-Number(l.credit),0);const period=all.filter(l=>!from||l.journal_entries.entry_date>=from);const total_debit=period.reduce((n,l)=>n+Number(l.debit),0),total_credit=period.reduce((n,l)=>n+Number(l.credit),0);return{account_id:a.id,code:a.code,name:a.name,type:a.type,opening,total_debit,total_credit,balance:opening+total_debit-total_credit}});

  const totalDebit = (rows || []).reduce((a, r) => a + Number(r.total_debit), 0);
  const totalCredit = (rows || []).reduce((a, r) => a + Number(r.total_credit), 0);
  const exportRows = (rows || []).map((r) => ({ Code: r.code, Account: r.name, Type: r.type, Debit: r.total_debit, Credit: r.total_credit, Balance: r.balance }));

  return (
    <div>
      <FinanceNav current="/accounting/trial-balance" />
      <DocumentPrintHeader branding={branding} title="Trial Balance" meta={`Generated ${fmtDate(new Date().toISOString())}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Trial Balance</h2>
      <p className="no-print text-slate text-sm mb-5">Every account&apos;s total debits and credits, calculated live from posted journal entries.</p>
      <form className="no-print mb-3 flex flex-wrap items-end gap-2"><label className="text-xs font-semibold text-slate">From<br/><input className="in mt-1" name="from" type="date" defaultValue={from}/></label><label className="text-xs font-semibold text-slate">To<br/><input className="in mt-1" name="to" type="date" defaultValue={to}/></label><label className="text-xs font-semibold text-slate">Account<br/><select className="in mt-1" name="account" defaultValue={account}><option value="">All accounts</option>{(accounts||[]).map(a=><option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label><button className="rounded-xl bg-navy px-4 py-2 text-xs font-semibold text-white">Apply</button></form>

      <div className="no-print flex gap-2.5 mb-3">
        <DocumentActionBar
          print
          excel={{ rows: exportRows, sheetName: "Trial Balance", reportTitle: "Trial Balance", branding }}
          share={{ title: "Trial Balance" }}
        />
      </div>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Code</Th><Th>Account</Th><Th>Opening</Th><Th>Debit</Th><Th>Credit</Th><Th>Closing</Th></tr></thead>
          <tbody>
            {(rows || []).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No postings yet.</td></tr>}
            {(rows || []).filter((r) => Number(r.total_debit) > 0 || Number(r.total_credit) > 0).map((r) => (
              <tr key={r.account_id} className="hover:bg-foam">
                <Td className="font-mono-num text-xs">{r.code}</Td>
                <Td className="font-semibold"><Link className="hover:text-aqua" href={`/accounting/general-ledger?account=${r.account_id}`}>{r.name}</Link></Td>
                <Td>{r.opening ? pkr(r.opening) : ""}</Td>
                <Td>{Number(r.total_debit) > 0 ? pkr(r.total_debit) : ""}</Td>
                <Td>{Number(r.total_credit) > 0 ? pkr(r.total_credit) : ""}</Td>
                <Td>{pkr(r.balance)}</Td>
              </tr>
            ))}
          </tbody>
          {(rows || []).length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ink font-bold">
                <Td colSpan={2}>Total</Td><Td>{pkr(rows.reduce((a,r)=>a+r.opening,0))}</Td>
                <Td>{pkr(totalDebit)}</Td>
                <Td>{pkr(totalCredit)}</Td>
                <Td>{pkr(rows.reduce((a,r)=>a+r.balance,0))}</Td>
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
