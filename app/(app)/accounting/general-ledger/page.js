import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import FinanceNav from "@/components/FinanceNav";
import { Th, Td, DocumentActionBar } from "@/components/ui";
import { pkr, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export default async function GeneralLedgerPage({ searchParams }) {
  const sp = (await searchParams) || {}; const account = sp.account || ""; const from = sp.from || ""; const to = sp.to || "";
  const supabase = await createClient();
  const { data: accounts } = await supabase.from("chart_of_accounts").select("id,code,name").eq("is_active", true).order("code");
  let query = supabase.from("journal_lines").select("id,debit,credit,journal_entries!inner(entry_no,entry_date,reference,description,status),chart_of_accounts!inner(id,code,name)").eq("journal_entries.status", "posted").order("id", { ascending: true }).limit(1000);
  if (account) query = query.eq("account_id", account); if (from) query = query.gte("journal_entries.entry_date", from); if (to) query = query.lte("journal_entries.entry_date", to);
  const { data: lines } = await query; let running = 0;
  const rows = (lines || []).map((line) => ({ ...line, running: running += Number(line.debit) - Number(line.credit) }));
  return <div><FinanceNav current="/accounting/general-ledger" /><h2 className="font-display text-2xl font-semibold">General Ledger</h2><p className="mb-4 text-sm text-slate">Posted account movements with a running balance and source drill-down.</p>
    <form className="no-print mb-3 flex flex-wrap items-end gap-2"><label className="text-xs font-semibold text-slate">Account<br/><select name="account" defaultValue={account} className="in mt-1"><option value="">All accounts</option>{(accounts||[]).map(a=><option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label><label className="text-xs font-semibold text-slate">From<br/><input className="in mt-1" type="date" name="from" defaultValue={from}/></label><label className="text-xs font-semibold text-slate">To<br/><input className="in mt-1" type="date" name="to" defaultValue={to}/></label><button className="rounded-xl bg-navy px-4 py-2 text-xs font-semibold text-white">Apply</button><DocumentActionBar print excel={{ rows: rows.map(r=>({Date:r.journal_entries.entry_date,Entry:r.journal_entries.entry_no,Account:r.chart_of_accounts.name,Debit:r.debit,Credit:r.credit,Balance:r.running})), sheetName:"General Ledger", reportTitle:"General Ledger" }}/></form>
    <div className="overflow-x-auto rounded-2xl border border-line"><table className="w-full text-[13px]"><thead><tr><Th>Date</Th><Th>Entry</Th><Th>Account</Th><Th>Description</Th><Th>Debit</Th><Th>Credit</Th><Th>Balance</Th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><Td>{fmtDate(r.journal_entries.entry_date)}</Td><Td><Link className="font-semibold text-aqua" href={`/accounting/journal?q=${encodeURIComponent(r.journal_entries.entry_no)}`}>{r.journal_entries.entry_no}</Link></Td><Td>{r.chart_of_accounts.code} — {r.chart_of_accounts.name}</Td><Td>{r.journal_entries.description}</Td><Td>{Number(r.debit)?pkr(r.debit):""}</Td><Td>{Number(r.credit)?pkr(r.credit):""}</Td><Td>{pkr(r.running)}</Td></tr>)}</tbody></table></div>
  </div>;
}
