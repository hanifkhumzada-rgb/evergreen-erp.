import { createClient } from "@/lib/supabase/server";
import { ExportExcelButton, PrintButton, Th, Td, pkr, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";
const TOTAL_OWNED = 500;
const BOTTLE_COST = 800; // replacement cost per 19L bottle, used for valuation

export default async function BottleLedgerPage() {
  const supabase = await createClient();
  const [{ data: customers }, { data: movements }] = await Promise.all([
    supabase.from("customers").select("name, bottles_delivered, bottles_returned"),
    supabase.from("bottle_movements").select("*, customers(name)").order("moved_at", { ascending: false }).limit(150),
  ]);

  const withCustomers = (customers || []).reduce((a, c) => a + (c.bottles_delivered - c.bottles_returned), 0);
  const full = TOTAL_OWNED - withCustomers;
  const liabilityValue = withCustomers * BOTTLE_COST;
  const exportRows = (movements || []).map((m) => ({ Date: m.moved_at, Customer: m.customers?.name, Type: m.movement_type, Qty: m.qty }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Bottle Ledger</h2>
      <p className="text-slate text-sm mb-5">Professional bottle accounting — every movement traceable, valued against replacement cost.</p>

      <div className="flex gap-3 flex-wrap mb-6">
        <Stat label="Total owned" value={TOTAL_OWNED} />
        <Stat label="Full (available)" value={full} />
        <Stat label="With customers" value={withCustomers} />
        <Stat label="Bottle liability value" value={pkr(liabilityValue)} sub={`@ ${pkr(BOTTLE_COST)}/bottle replacement cost`} />
      </div>

      <div className="no-print flex gap-2.5 mb-3">
        <ExportExcelButton rows={exportRows} filename="bottle-ledger.xlsx" sheetName="Bottle Ledger" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Customer</Th><Th>Movement</Th><Th>Qty</Th></tr></thead>
          <tbody>
            {(movements || []).length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate">No movements recorded yet.</td></tr>}
            {(movements || []).map((m) => <tr key={m.id} className="hover:bg-foam"><Td>{fmtDate(m.moved_at)}</Td><Td>{m.customers?.name || "—"}</Td><Td>{m.movement_type}</Td><Td>{m.qty}</Td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate mt-3">Note: bottle liability here is shown for reporting only — it is not yet posted as a formal journal entry against &quot;Customer Bottle Deposit Liability&quot;. See Settings for what&apos;s still pending.</p>
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
