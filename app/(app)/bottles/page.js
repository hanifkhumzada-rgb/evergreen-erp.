import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Search } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";

export const dynamic = "force-dynamic";

export default async function BottlesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || "").trim().toLowerCase();
  const supabase = await createClient();
  const [branding, { data: rows }, { data: products }, { data: reconciliation }, { data: customerMaster }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("v_customer_bottle_balance").select("customer_id, name, product_id, bottles_with_customer"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("v_bottle_reconciliation").select("product_id, total_assets, warehouse"),
    supabase.from("customers").select("id, code, name, mobile, bottle_limit, is_active"),
  ]);

  // Each bottle size gets its own column and its own ledger — never mixed
  // into one combined number, per customer.
  const totalOwnedMap = {};
  (reconciliation || []).forEach((r) => { totalOwnedMap[r.product_id] = Number(r.total_assets); });

  const masterMap = Object.fromEntries((customerMaster || []).map((c) => [c.id, c]));
  const byCustomer = Object.fromEntries((customerMaster || []).map((c) => [c.id, { ...c, byProduct: {}, total: 0 }]));
  (rows || []).forEach((r) => {
    const entry = byCustomer[r.customer_id] || { ...masterMap[r.customer_id], id: r.customer_id, name: r.name, byProduct: {}, total: 0 };
    entry.byProduct[r.product_id] = Number(r.bottles_with_customer);
    entry.total += Number(r.bottles_with_customer);
    byCustomer[r.customer_id] = entry;
  });
  const allCustomers = Object.values(byCustomer);
  // KPIs always reflect every customer, even while a search is narrowing
  // the table below — searching shouldn't make "With customers" look wrong.
  const withCustomers = allCustomers.reduce((a, c) => a + c.total, 0);
  const totalOwned = Object.values(totalOwnedMap).reduce((a, v) => a + v, 0);
  const full = (reconciliation || []).reduce((sum, row) => sum + Number(row.warehouse || 0), 0);
  const customers = q ? allCustomers.filter((c) => [c.code, c.name, c.mobile].filter(Boolean).join(" ").toLowerCase().includes(q)) : allCustomers;
  const exportRows = customers.map((c) => {
    const row = { "Customer ID": c.code, Customer: c.name, Phone: c.mobile };
    (products || []).forEach((p) => { row[p.name] = c.byProduct[p.id] || 0; });
    row.Total = c.total;
    return row;
  });

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Bottle Tracking" meta={`${customers.length} customers\nGenerated ${fmtDate(new Date().toISOString())}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Bottle Tracking</h2>
      <p className="no-print text-slate text-sm mb-1">Total owned: {totalOwned} bottles across {(products || []).length} sizes · sourced live from bottle_transactions</p>
      <p className="no-print text-slate text-xs mb-5">Opening + Delivered − Returned − Damaged/Lost ± Adjustments = Current Balance. Click a customer for the full per-size breakdown and movement history.</p>

      <div className="flex gap-5 flex-wrap mb-7">
        <Stat label="Warehouse stock" value={full} />
        <Stat label="With customers" value={withCustomers} />
      </div>

      <h4 className="text-sm font-bold mb-2.5">Customer bottle balances, by size</h4>
      <form className="no-print flex flex-wrap gap-2.5 mb-3 items-center" action="/bottles">
        <input type="text" name="q" defaultValue={sp.q || ""} placeholder="Search customer ID, name or phone…" className="in w-52" />
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold"><Search size={14} className="inline mr-1.5" />Search</button>
        {q && <Link href="/bottles" className="text-xs text-slate hover:text-aqua">Clear</Link>}
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} sheetName="Bottles" reportTitle="Bottle Balances" branding={branding} />
        <PrintButton />
      </form>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead>
            <tr className="bg-foam">
              <Th>Customer ID</Th><Th>Customer</Th><Th>Phone</Th>
              {(products || []).map((p) => <Th key={p.id}>{p.name}</Th>)}
              <Th>Total</Th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && <tr><td colSpan={(products || []).length + 4} className="text-center py-8 text-slate">No customers match this search.</td></tr>}
            {customers.map((c, i) => (
              <tr key={i} className="hover:bg-foam">
                <Td className="font-mono-num text-slate">{c.code || "—"}</Td>
                <Td><Link href={`/customers/${c.id}`} className="font-semibold text-navy hover:text-aqua">{c.name}</Link></Td><Td>{c.mobile || "—"}</Td>
                {(products || []).map((p) => <Td key={p.id}>{c.byProduct[p.id] || 0}</Td>)}
                <Td><span className={c.total > (c.bottle_limit ?? 20) ? "text-coral font-semibold" : "font-semibold"}>{c.total}{c.total > 10 ? " ⚠" : ""}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DocumentPrintFooter />
    </div>
  );
}
function Stat({ label, value }) {
  return <div className="text-center flex-1 min-w-[130px]"><div className="font-mono-num font-bold text-2xl text-aqua">{value}</div><div className="text-xs text-slate mt-1">{label}</div></div>;
}
