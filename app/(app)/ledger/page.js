import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pkr, fmtDate, refNoFromDescription } from "@/lib/format";
import { KPI, ExportExcelButton, PrintButton, DownloadPdfButton, Th, Td } from "@/components/ui";
import WhatsAppButton from "@/components/WhatsAppButton";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import { getBrandingLite } from "@/lib/pdf/business";

export const dynamic = "force-dynamic";

export default async function LedgerPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();

  if (sp.customer) {
    return <CustomerTimeline supabase={supabase} customerId={sp.customer} />;
  }

  const q = (sp.q || "").trim().toLowerCase();
  const [branding, { data: customers }, { data: balances }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("customers").select("*").order("name"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
  ]);
  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const allRows = (customers || []).map((c) => ({ ...c, balance: balanceMap[c.id] || 0 }));
  const rows = q
    ? allRows.filter((c) => [c.code, c.name, c.mobile].filter(Boolean).join(" ").toLowerCase().includes(q))
    : allRows;

  const totalOutstanding = allRows.reduce((a, c) => a + Math.max(c.balance, 0), 0);
  const totalCredit = allRows.reduce((a, c) => a + Math.max(-c.balance, 0), 0);
  const customersWithBalance = allRows.filter((c) => c.balance > 0).length;
  const exportRows = allRows.map((c) => ({ Customer: c.name, Opening: c.opening_balance, CurrentBalance: c.balance, CreditLimit: c.credit_limit }));

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Customer Ledger" meta={`${rows.length} of ${allRows.length} customers\nGenerated ${fmtDate(new Date().toISOString())}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Customer Ledger</h2>
      <p className="no-print text-slate text-sm mb-4">Pick a customer to see their ledger as a running timeline.</p>

      <div className="no-print flex flex-wrap gap-3.5 mb-5">
        <KPI label="TOTAL RECEIVABLE" value={pkr(totalOutstanding)} tone="coral" />
        <KPI label="CUSTOMERS WITH BALANCE" value={customersWithBalance} tone="amber" />
        <KPI label="CREDIT BALANCES" value={pkr(totalCredit)} tone="green" sub="customers who have overpaid" />
        <KPI label="TOTAL CUSTOMERS" value={allRows.length} tone="navy" />
      </div>

      <form className="no-print flex flex-wrap gap-2.5 mb-2 items-center" action="/ledger">
        <input type="text" name="q" defaultValue={sp.q || ""} placeholder="Search name, ID, phone…" className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-56" />
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Search</button>
        {q && <Link href="/ledger" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>
      {/* Sibling <div>, not inside the search <form> above — same
          missing-type="button" issue that broke /customers' "New Customer". */}
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="evergreen-ledger.xlsx" sheetName="Ledger" />
        <DownloadPdfButton href="/api/pdf/outstanding" label="Download Outstanding PDF" />
        <PrintButton />
      </div>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Customer</Th><Th>Opening</Th><Th>Current Balance</Th><Th>Credit Limit</Th><Th className="no-print">&nbsp;</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate">No customers match.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-foam cursor-pointer">
                <Td><Link href={`/ledger?customer=${c.id}`} className="font-semibold text-navy hover:text-aqua">{c.name}</Link></Td>
                <Td>{pkr(c.opening_balance)}</Td>
                <Td><span className={c.balance > 0 ? "text-coral font-semibold" : "text-green font-semibold"}>{pkr(c.balance)}</span></Td>
                <Td>{pkr(c.credit_limit)}</Td>
                <Td className="no-print">
                  {c.balance > 0 && (
                    <WhatsAppButton phone={c.mobile}
                      message={`Hi ${c.name}, this is a friendly reminder from Evergreen Water — your current outstanding balance is Rs ${Math.round(c.balance).toLocaleString("en-PK")}. Please arrange payment at your earliest convenience. Thank you!`} />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DocumentPrintFooter />
    </div>
  );
}

async function CustomerTimeline({ supabase, customerId }) {
  const [branding, { data: c }, { data: entries }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("customers").select("*, zones(name)").eq("id", customerId).maybeSingle(),
    supabase.from("customer_ledger_entries").select("*").eq("customer_id", customerId).order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
  ]);

  if (!c) {
    return (
      <div>
        <Link href="/ledger" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customer Ledger</Link>
        <p>Customer not found.</p>
      </div>
    );
  }

  // Opening balance is its own statement line (below), so the ledger's own
  // 'opening' entry — posted automatically at registration for the exact
  // same amount (fn_post_opening_balance) — is excluded from the
  // transaction rows, or it would be counted twice. Running balance then
  // walks oldest-first from that seed, same as the PDF statement
  // (CustomerStatementDocument) so the two always agree.
  const openingBalance = Number(c.opening_balance) || 0;
  let running = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  const chronological = (entries || []).filter((e) => e.reference_type !== "opening").map((e) => {
    const debit = Number(e.debit) || 0;
    const credit = Number(e.credit) || 0;
    running += debit - credit;
    totalDebit += debit;
    totalCredit += credit;
    return { ...e, runningBalance: running };
  });
  const closingBalance = running;

  return (
    <div>
      <DocumentPrintHeader printOnly={false} branding={branding} title="Client Account Statement"
        meta={`Period: All activity to date\nGenerated: ${fmtDate(new Date().toISOString())}`} />
      <Link href="/ledger" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customer Ledger</Link>
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="text-[10px] font-bold text-slate uppercase tracking-wide mb-1">Statement For</div>
          <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
          <p className="text-slate text-sm mt-1">Client ID: <span className="font-mono-num">{c.code || "—"}</span> · {[c.mobile, c.address, c.zones?.name].filter(Boolean).join("  ·  ")}</p>
        </div>
        <div className="no-print flex gap-2">
          {closingBalance > 0 && (
            <WhatsAppButton phone={c.mobile}
              message={`Hi ${c.name}, this is a friendly reminder from Evergreen Water — your current outstanding balance is Rs ${Math.round(closingBalance).toLocaleString("en-PK")}. Please arrange payment at your earliest convenience. Thank you!`} />
          )}
          <DownloadPdfButton href={`/api/pdf/customer-statement/${c.id}`} label="Download Statement" />
          <PrintButton />
          <Link href={`/customers/${c.id}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold">Full Profile</Link>
        </div>
      </div>

      <div className="overflow-x-auto border border-line rounded-2xl mb-4">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-foam">
              <Th>Date</Th><Th>Reference No.</Th><Th>Description</Th>
              <Th className="text-right">Debit</Th><Th className="text-right">Credit</Th><Th className="text-right">Balance</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-foam font-semibold">
              <Td>—</Td><Td>—</Td><Td>Opening Balance</Td>
              <Td className="text-right">—</Td><Td className="text-right">—</Td><Td className="text-right">{pkr(openingBalance)}</Td>
            </tr>
            {chronological.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No ledger activity recorded yet.</td></tr>}
            {chronological.map((e) => (
              <tr key={e.id} className="hover:bg-foam">
                <Td>{fmtDate(e.entry_date)}</Td>
                <Td className="text-slate">{refNoFromDescription(e.description)}</Td>
                <Td>{e.description}</Td>
                <Td className="text-right text-slate">{e.debit ? pkr(e.debit) : "—"}</Td>
                <Td className="text-right text-slate">{e.credit ? pkr(e.credit) : "—"}</Td>
                <Td className="text-right font-semibold">{pkr(e.runningBalance)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-4">
        <div className="w-full sm:w-72 text-[13px]">
          <div className="flex justify-between py-1"><span className="text-slate">Total Debit</span><span>{pkr(totalDebit)}</span></div>
          <div className="flex justify-between py-1"><span className="text-slate">Total Credit</span><span className="text-green">{pkr(totalCredit)}</span></div>
          <div className={`flex justify-between items-center py-2.5 px-3 mt-2 rounded-lg text-white ${closingBalance > 0 ? "bg-navy" : "bg-green"}`}>
            <span className="text-sm font-bold">Closing Balance / Outstanding</span>
            <span className="text-lg font-bold">{pkr(closingBalance)}</span>
          </div>
        </div>
      </div>
      <p className="no-print text-[11px] text-slate">Debit increases what the customer owes (sales/deliveries), credit reduces it (payments). Rows read oldest to newest, matching the downloadable statement.</p>
      <DocumentPrintFooter />
    </div>
  );
}
