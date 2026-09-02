import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";
const BOTTLE_COST = 800; // avg. replacement cost per bottle across sizes — a labeled approximation, not a per-size cost (products has no per-size cost field yet)

export default async function BottleLedgerPage() {
  const supabase = await createClient();
  const [{ data: balances }, { data: movements }, { data: customers }, { data: reconciliation }] = await Promise.all([
    supabase.from("v_customer_bottle_balance").select("customer_id, name, bottles_with_customer"),
    supabase.from("bottle_transactions").select("*, customers(name), products(name)").order("created_at", { ascending: false }).limit(150),
    supabase.from("customers").select("id, bottle_limit"),
    supabase.from("v_bottle_reconciliation").select("*").order("product_name"),
  ]);

  const bySize = reconciliation || [];
  const totalOwned = bySize.reduce((a, s) => a + Number(s.total_assets), 0);
  const withCustomers = (balances || []).reduce((a, b) => a + Number(b.bottles_with_customer), 0);
  const full = totalOwned - withCustomers;
  const liabilityValue = withCustomers * BOTTLE_COST;
  const exportRows = (movements || []).map((m) => ({ Date: m.txn_date, Customer: m.customers?.name, Size: m.products?.name, From: m.from_state, To: m.to_state, Qty: m.quantity }));

  const limitMap = {};
  (customers || []).forEach((c) => { limitMap[c.id] = c.bottle_limit ?? 20; });
  const perCustomer = {};
  (balances || []).forEach((b) => {
    const row = perCustomer[b.customer_id] || { customer_id: b.customer_id, name: b.name, total: 0 };
    row.total += Number(b.bottles_with_customer);
    perCustomer[b.customer_id] = row;
  });
  const needsAttention = Object.values(perCustomer).filter((c) => c.total < 0 || c.total > (limitMap[c.customer_id] ?? 20));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Bottle Ledger</h2>
      <p className="text-slate text-sm mb-5">Professional bottle accounting — every movement traceable, valued against replacement cost.</p>

      {needsAttention.length > 0 && (
        <div className="border border-coral/40 bg-coralSoft rounded-2xl p-4 mb-5">
          <h4 className="text-sm font-bold mb-2 flex items-center gap-1.5 text-coral"><AlertTriangle size={15} /> Needs Attention ({needsAttention.length})</h4>
          <div className="flex flex-col gap-1.5">
            {needsAttention.map((c) => (
              <Link key={c.customer_id} href={`/customers/${c.customer_id}`} className="text-xs flex justify-between items-center px-3 py-2 rounded-lg bg-card hover:bg-foam">
                <span className="font-semibold">{c.name}</span>
                <span className={c.total < 0 ? "text-coral" : "text-amber"}>
                  {c.total < 0 ? `Negative balance: ${c.total} bottles (data entry error)` : `${c.total} bottles — over limit of ${limitMap[c.customer_id] ?? 20}`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap mb-6">
        <Stat label="Total owned (all sizes)" value={totalOwned} />
        <Stat label="Full (available)" value={full} />
        <Stat label="With customers" value={withCustomers} />
        <Stat label="Bottle liability value" value={pkr(liabilityValue)} sub={`@ ${pkr(BOTTLE_COST)}/bottle avg. replacement cost`} />
      </div>

      <h4 className="text-sm font-bold mb-2.5">By bottle size</h4>
      <div className="overflow-x-auto border border-line rounded-2xl mb-6">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Size</Th><Th>Warehouse</Th><Th>With Rider</Th><Th>With Customers</Th><Th>Damaged</Th><Th>Lost</Th><Th>Total</Th></tr></thead>
          <tbody>
            {bySize.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate">No bottle movements yet.</td></tr>}
            {bySize.map((s) => (
              <tr key={s.product_id} className="hover:bg-foam">
                <Td className="font-semibold">{s.product_name}</Td>
                <Td>{s.warehouse}</Td><Td>{s.with_rider}</Td><Td>{s.with_customer}</Td>
                <Td className={Number(s.damaged) > 0 ? "text-coral" : ""}>{s.damaged}</Td>
                <Td className={Number(s.lost) > 0 ? "text-coral" : ""}>{s.lost}</Td>
                <Td className="font-semibold">{s.total_assets}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="no-print flex gap-2.5 mb-3">
        <ExportExcelButton rows={exportRows} filename="bottle-ledger.xlsx" sheetName="Bottle Ledger" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Customer</Th><Th>Size</Th><Th>From</Th><Th>To</Th><Th>Qty</Th></tr></thead>
          <tbody>
            {(movements || []).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No movements recorded yet.</td></tr>}
            {(movements || []).map((m) => <tr key={m.id} className="hover:bg-foam"><Td>{fmtDate(m.txn_date)}</Td><Td>{m.customers?.name || "—"}</Td><Td>{m.products?.name || "—"}</Td><Td>{m.from_state}</Td><Td>{m.to_state}</Td><Td>{m.quantity}</Td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate mt-3">Note: bottle liability here is shown for reporting only — it is not posted as a formal ledger entry against a &quot;Customer Bottle Deposit Liability&quot; account (the live database has no chart-of-accounts engine). See Settings for what&apos;s still pending.</p>
    </div>
  );
}
function Stat({ label, value, sub }) {
  return (
    <div className="text-center flex-1 min-w-[150px] border border-line rounded-2xl py-4">
      <div className="font-mono-num font-bold text-2xl text-aqua">{value}</div>
      <div className="text-xs text-slate mt-1">{label}</div>
      {sub && <div className="text-[10.5px] text-slate mt-0.5">{sub}</div>}
    </div>
  );
}
