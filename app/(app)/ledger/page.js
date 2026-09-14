import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, Eye, Search } from "lucide-react";
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
    return <CustomerTimeline supabase={supabase} customerId={sp.customer} filters={sp} />;
  }

  const q = (sp.q || "").trim().toLowerCase();
  const [branding, { data: customers }, { data: balances }, { data: zones }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("customers").select("*").order("name"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
    supabase.from("zones").select("id,name").order("name"),
  ]);
  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const allRows = (customers || []).map((c) => ({ ...c, balance: balanceMap[c.id] || 0 }));
  let rows = q
    ? allRows.filter((c) => [c.code, c.name, c.mobile].filter(Boolean).join(" ").toLowerCase().includes(q))
    : allRows;
  if (sp.zone) rows = rows.filter((c) => c.zone_id === sp.zone);
  if (sp.outstanding === "1") rows = rows.filter((c) => c.balance > 0);

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
        <select name="zone" defaultValue={sp.zone||""} className="px-3 py-2 rounded-xl border border-line bg-card text-xs"><option value="">All zones</option>{(zones||[]).map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select>
        <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-semibold"><input type="checkbox" name="outstanding" value="1" defaultChecked={sp.outstanding==="1"}/> Outstanding only</label>
        <button type="submit" className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold"><Search size={14}/>Search</button>
        {(q||sp.zone||sp.outstanding) && <Link href="/ledger" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>
      {/* Sibling <div>, not inside the search <form> above — same
          missing-type="button" issue that broke /customers' "New Customer". */}
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} sheetName="Ledger" reportTitle="Customer Ledger" branding={branding} />
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

async function CustomerTimeline({ supabase, customerId, filters }) {
  const [branding, { data: c }, { data: entries }, { data: bottles }, { data: deliveries }, { data: invoices }, { data: payments }, { data: profiles }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("customers").select("*, zones(name)").eq("id", customerId).maybeSingle(),
    supabase.from("customer_ledger_entries").select("*").eq("customer_id", customerId).order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("bottle_transactions").select("*").eq("customer_id",customerId).order("txn_date"),
    supabase.from("deliveries").select("id,delivery_no,status,delivery_items(delivered_qty,returned_qty,unit_price)").eq("customer_id",customerId),
    supabase.from("invoices").select("id,invoice_no,status,net_amount").eq("customer_id",customerId).neq("status","void"),
    supabase.from("payments").select("id,receipt_no,amount,payment_date,method,voided").eq("customer_id",customerId),
    supabase.from("profiles").select("id,full_name"),
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
  const deliveryMap=Object.fromEntries((deliveries||[]).map(d=>[d.id,d]));
  const invoiceMap=Object.fromEntries((invoices||[]).map(d=>[d.id,d]));
  const paymentMap=Object.fromEntries((payments||[]).map(d=>[d.id,d]));
  const profileMap=Object.fromEntries((profiles||[]).map(p=>[p.id,p.full_name]));
  const bottleByRef={}; (bottles||[]).forEach(b=>{const k=b.reference_id||b.id;bottleByRef[k]??={out:0,returned:0};if(b.to_state==="with_customer")bottleByRef[k].out+=Number(b.quantity)||0;if(b.from_state==="with_customer"&&b.to_state!=="with_customer")bottleByRef[k].returned+=Number(b.quantity)||0;});
  let running = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  let runningBottles=Number(c.opening_bottles)||0;
  let chronological = (entries || []).filter((e) => e.reference_type !== "opening").map((e) => {
    const debit = Number(e.debit) || 0;
    const credit = Number(e.credit) || 0;
    running += debit - credit;
    totalDebit += debit;
    totalCredit += credit;
    const d=deliveryMap[e.reference_id], inv=invoiceMap[e.reference_id], pay=paymentMap[e.reference_id], movement=bottleByRef[e.reference_id]||{out:0,returned:0};
    runningBottles+=movement.out-movement.returned;
    const item=d?.delivery_items?.[0];
    return { ...e, runningBalance: running, runningBottles, qty:Number(item?.delivered_qty)||0, rate:Number(item?.unit_price)||0, bottlesOut:movement.out, bottlesReturned:movement.returned, paymentStatus:inv?.status||(pay?(pay.voided?"void":"received"):d?.status||"—"), enteredBy:profileMap[e.created_by]||"—", refNo:d?.delivery_no||inv?.invoice_no||pay?.receipt_no||refNoFromDescription(e.description), entryStatus:"Approved" };
  });
  if(filters.from) chronological=chronological.filter(e=>e.entry_date>=filters.from);
  if(filters.to) chronological=chronological.filter(e=>e.entry_date<=filters.to);
  if(filters.month) chronological=chronological.filter(e=>e.entry_date?.startsWith(filters.month));
  if(filters.type) chronological=chronological.filter(e=>e.reference_type===filters.type);
  const closingBalance = running;
  const totalDelivered=(deliveries||[]).reduce((s,d)=>s+(d.delivery_items||[]).reduce((a,i)=>a+Number(i.delivered_qty||0),0),0);
  const totalInvoiced=(invoices||[]).reduce((s,i)=>s+Number(i.net_amount||0),0);
  const totalReceived=(payments||[]).filter(p=>!p.voided).reduce((s,p)=>s+Number(p.amount||0),0);
  const currentBottleBalance=(bottles||[]).reduce((s,b)=>s+(b.to_state==="with_customer"?Number(b.quantity||0):b.from_state==="with_customer"?-Number(b.quantity||0):0),Number(c.opening_bottles)||0);

  return (
    <div>
      <DocumentPrintHeader printOnly={false} branding={branding} title="Client Account Statement"
        meta={`Period: All activity to date\nGenerated: ${fmtDate(new Date().toISOString())}`} />
      <Link href="/ledger" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customer Ledger</Link>
      <div className="no-print mb-4 text-xs text-slate"><Link href="/dashboard">Dashboard</Link> / <Link href="/ledger">Customer Ledger</Link> / <span>{c.name}</span></div>
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

      <div className="no-print mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KPI label="TOTAL DELIVERIES" value={totalDelivered} tone="navy"/><KPI label="TOTAL INVOICED" value={pkr(totalInvoiced)} tone="amber"/><KPI label="TOTAL RECEIVED" value={pkr(totalReceived)} tone="green"/><KPI label="CURRENT OUTSTANDING" value={pkr(closingBalance)} tone="coral"/><KPI label="BOTTLES OUT" value={currentBottleBalance} tone="navy"/>
      </div>
      <form className="no-print mb-4 flex flex-wrap gap-2" action="/ledger"><input type="hidden" name="customer" value={customerId}/><input name="from" type="date" defaultValue={filters.from||""} className="rounded-xl border border-line bg-card px-3 py-2 text-xs"/><input name="to" type="date" defaultValue={filters.to||""} className="rounded-xl border border-line bg-card px-3 py-2 text-xs"/><input name="month" type="month" defaultValue={filters.month||""} className="rounded-xl border border-line bg-card px-3 py-2 text-xs"/><select name="type" defaultValue={filters.type||""} className="rounded-xl border border-line bg-card px-3 py-2 text-xs"><option value="">All transactions</option><option value="delivery">Deliveries</option><option value="invoice">Invoices</option><option value="payment">Payments</option><option value="smart_adjustment">Adjustments</option></select><button className="rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white">Apply Filters</button></form>

      <div className="overflow-x-auto border border-line rounded-2xl mb-4">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-foam">
              <Th>Date</Th><Th>Reference</Th><Th>Type</Th><Th>Description</Th><Th>Qty</Th><Th>Rate</Th>
              <Th className="text-right">Debit</Th><Th className="text-right">Credit</Th><Th className="text-right">Outstanding</Th><Th>Bottles Out</Th><Th>Returned</Th><Th>Bottle Balance</Th><Th>Payment</Th><Th>Status</Th><Th>Entered By</Th><Th className="no-print">View</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-foam font-semibold">
              <Td>—</Td><Td>OPENING</Td><Td>Opening</Td><Td>Opening Balance</Td><Td>—</Td><Td>—</Td>
              <Td className="text-right">—</Td><Td className="text-right">—</Td><Td className="text-right">{pkr(openingBalance)}</Td><Td>—</Td><Td>—</Td><Td>{Number(c.opening_bottles)||0}</Td><Td>—</Td><Td>Approved</Td><Td>System</Td><Td>—</Td>
            </tr>
            {chronological.length === 0 && <tr><td colSpan={16} className="text-center py-8 text-slate">No ledger activity recorded for these filters.</td></tr>}
            {chronological.map((e) => (
              <tr key={e.id} className="hover:bg-foam">
                <Td>{fmtDate(e.entry_date)}</Td>
                <Td className="font-mono text-slate">{e.refNo}</Td><Td className="capitalize">{e.reference_type?.replaceAll("_"," ")}</Td>
                <Td>{e.description}</Td>
                <Td>{e.qty||"—"}</Td><Td>{e.rate?pkr(e.rate):"—"}</Td>
                <Td className="text-right text-slate">{e.debit ? pkr(e.debit) : "—"}</Td>
                <Td className="text-right text-slate">{e.credit ? pkr(e.credit) : "—"}</Td>
                <Td className="text-right font-semibold">{pkr(e.runningBalance)}</Td>
                <Td>{e.bottlesOut||"—"}</Td><Td>{e.bottlesReturned||"—"}</Td><Td>{e.runningBottles}</Td><Td className="capitalize">{e.paymentStatus}</Td><Td><span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">{e.entryStatus}</span></Td><Td>{e.enteredBy}</Td><Td className="no-print"><Link href={e.reference_type==="delivery"?`/deliveries?q=${e.refNo}`:e.reference_type==="invoice"?`/invoices?q=${e.refNo}`:"#"} title="View original"><Eye size={16}/></Link></Td>
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
