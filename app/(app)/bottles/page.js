import { createClient } from "@/lib/supabase/server";
import { ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";
const TOTAL_OWNED = 500;

export default async function BottlesPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("v_customer_bottle_balance").select("customer_id, name, bottles_with_customer");

  const byCustomer = {};
  (rows || []).forEach((r) => {
    byCustomer[r.customer_id] = byCustomer[r.customer_id] || { name: r.name, balance: 0 };
    byCustomer[r.customer_id].balance += Number(r.bottles_with_customer);
  });
  const customers = Object.values(byCustomer);
  const withCustomers = customers.reduce((a, c) => a + c.balance, 0);
  const full = TOTAL_OWNED - withCustomers;
  const exportRows = customers.map((c) => ({ Customer: c.name, Balance: c.balance }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Bottle Tracking</h2>
      <p className="text-slate text-sm mb-5">Total owned: {TOTAL_OWNED} bottles (19L) · sourced live from bottle_transactions</p>

      <div className="flex gap-5 flex-wrap mb-7">
        <Stat label="Full (available)" value={full} />
        <Stat label="With customers" value={withCustomers} />
      </div>

      <h4 className="text-sm font-bold mb-2.5">Customer bottle balances</h4>
      <div className="no-print flex gap-2.5 mb-3">
        <ExportExcelButton rows={exportRows} filename="bottle-balances.xlsx" sheetName="Bottles" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Customer</Th><Th>Balance</Th></tr></thead>
          <tbody>
            {customers.length === 0 && <tr><td colSpan={2} className="text-center py-8 text-slate">No bottle movements yet.</td></tr>}
            {customers.map((c, i) => (
              <tr key={i} className="hover:bg-foam"><Td>{c.name}</Td>
                <Td><span className={c.balance > 10 ? "text-coral font-semibold" : "font-semibold"}>{c.balance}{c.balance > 10 ? " ⚠" : ""}</span></Td></tr>
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
