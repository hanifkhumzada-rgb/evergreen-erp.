import { createClient } from "@/lib/supabase/server";
import { ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BottlesPage() {
  const supabase = await createClient();
  const [{ data: rows }, { data: products }, { data: reconciliation }] = await Promise.all([
    supabase.from("v_customer_bottle_balance").select("customer_id, name, product_id, bottles_with_customer"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("v_bottle_reconciliation").select("product_id, total_assets"),
  ]);

  // Each bottle size gets its own column and its own ledger — never mixed
  // into one combined number, per customer.
  const totalOwnedMap = {};
  (reconciliation || []).forEach((r) => { totalOwnedMap[r.product_id] = Number(r.total_assets); });

  const byCustomer = {};
  (rows || []).forEach((r) => {
    const entry = byCustomer[r.customer_id] || { name: r.name, byProduct: {}, total: 0 };
    entry.byProduct[r.product_id] = Number(r.bottles_with_customer);
    entry.total += Number(r.bottles_with_customer);
    byCustomer[r.customer_id] = entry;
  });
  const customers = Object.values(byCustomer);
  const withCustomers = customers.reduce((a, c) => a + c.total, 0);
  const totalOwned = Object.values(totalOwnedMap).reduce((a, v) => a + v, 0);
  const full = totalOwned - withCustomers;
  const exportRows = customers.map((c) => {
    const row = { Customer: c.name };
    (products || []).forEach((p) => { row[p.name] = c.byProduct[p.id] || 0; });
    row.Total = c.total;
    return row;
  });

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Bottle Tracking</h2>
      <p className="text-slate text-sm mb-5">Total owned: {totalOwned} bottles across {(products || []).length} sizes · sourced live from bottle_transactions</p>

      <div className="flex gap-5 flex-wrap mb-7">
        <Stat label="Full (available)" value={full} />
        <Stat label="With customers" value={withCustomers} />
      </div>

      <h4 className="text-sm font-bold mb-2.5">Customer bottle balances, by size</h4>
      <div className="no-print flex gap-2.5 mb-3">
        <ExportExcelButton rows={exportRows} filename="bottle-balances.xlsx" sheetName="Bottles" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead>
            <tr className="bg-foam">
              <Th>Customer</Th>
              {(products || []).map((p) => <Th key={p.id}>{p.name}</Th>)}
              <Th>Total</Th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && <tr><td colSpan={(products || []).length + 2} className="text-center py-8 text-slate">No bottle movements yet.</td></tr>}
            {customers.map((c, i) => (
              <tr key={i} className="hover:bg-foam">
                <Td>{c.name}</Td>
                {(products || []).map((p) => <Td key={p.id}>{c.byProduct[p.id] || 0}</Td>)}
                <Td><span className={c.total > 10 ? "text-coral font-semibold" : "font-semibold"}>{c.total}{c.total > 10 ? " ⚠" : ""}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Stat({ label, value }) {
  return <div className="text-center flex-1 min-w-[130px]"><div className="font-mono-num font-bold text-2xl text-aqua">{value}</div><div className="text-xs text-slate mt-1">{label}</div></div>;
}
