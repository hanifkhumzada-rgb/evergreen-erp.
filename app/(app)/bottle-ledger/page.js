import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import BottleReconciliationForm from "@/components/BottleReconciliationForm";
import BulkImportButton from "@/components/BulkImportButton";
import { bulkImportBottleOpeningBalances } from "@/app/actions";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";
const BOTTLE_COST = 800; // avg. replacement cost per bottle across sizes — a labeled approximation, not a per-size cost (products has no per-size cost field yet)
const UNRECONCILED_DAYS = 30;

// bottle_transactions carries reference_type + a from/to state pair, not a
// single "type" field — this is the one place that turns that pair into
// the Purchase/Delivery/Return/Damaged/Lost/Adjustment vocabulary the
// activity timeline shows, so every row (however it was recorded) reads
// the same way.
function movementType(m) {
  if (m.reference_type === "delivery") return { text: "Delivery", tone: "aqua" };
  if (m.reference_type === "delivery_return") return { text: "Return", tone: "green" };
  if (m.reference_type === "opening_balance") return { text: "Opening", tone: "slate" };
  if (m.to_state === "damaged") return { text: "Damaged", tone: "coral" };
  if (m.to_state === "lost") return { text: "Lost", tone: "coral" };
  if (m.reference_type === "reconciliation") return { text: "Adjustment", tone: "amber" };
  if (m.reference_type === "purchase") return { text: "Purchase", tone: "green" };
  return { text: "Adjustment", tone: "amber" };
}

export default async function BottleLedgerPage() {
  const supabase = await createClient();
  const [{ data: balances }, { data: movements }, { data: customers }, { data: reconciliation }, { data: products }, { data: reconHistory }] = await Promise.all([
    supabase.from("v_customer_bottle_balance").select("customer_id, name, bottles_with_customer"),
    supabase.from("bottle_transactions").select("*, customers(name), products(name), profiles(full_name)").order("created_at", { ascending: false }).limit(150),
    supabase.from("customers").select("id, bottle_limit"),
    supabase.from("v_bottle_reconciliation").select("*").order("product_name"),
    supabase.from("products").select("id, name, size_label").eq("is_active", true).order("name"),
    supabase.from("bottle_reconciliations").select("*, products(name)").order("recon_date", { ascending: false }).limit(20),
  ]);

  const bySize = reconciliation || [];
  const totalOwned = bySize.reduce((a, s) => a + Number(s.total_assets), 0);
  const withCustomers = (balances || []).reduce((a, b) => a + Number(b.bottles_with_customer), 0);
  const full = totalOwned - withCustomers;
  const liabilityValue = withCustomers * BOTTLE_COST;
  const warehouseTotal = bySize.reduce((a, s) => a + Number(s.warehouse), 0);
  const withRiderTotal = bySize.reduce((a, s) => a + Number(s.with_rider), 0);
  const damagedTotal = bySize.reduce((a, s) => a + Number(s.damaged), 0);
  const lostTotal = bySize.reduce((a, s) => a + Number(s.lost), 0);
  const exportRows = (movements || []).map((m) => ({ Date: m.txn_date, Type: movementType(m).text, Customer: m.customers?.name, Size: m.products?.name, From: m.from_state, To: m.to_state, Qty: m.quantity, By: m.profiles?.full_name }));

  // Before/after "with customer" balance per row — computed from each
  // customer+size's full transaction history (not just the 150-row feed
  // above), so the figures are the real running balance, not a guess
  // bounded by whatever page of the feed happens to be visible.
  const pairs = Array.from(new Set((movements || []).filter((m) => m.customer_id).map((m) => `${m.customer_id}|${m.product_id}`)));
  const runningBalance = {};
  if (pairs.length) {
    const customerIds = Array.from(new Set(pairs.map((p) => p.split("|")[0])));
    const { data: fullHistory } = await supabase.from("bottle_transactions")
      .select("id, customer_id, product_id, quantity, from_state, to_state, created_at")
      .in("customer_id", customerIds).order("created_at", { ascending: true });
    const byPair = {};
    (fullHistory || []).forEach((t) => {
      const key = `${t.customer_id}|${t.product_id}`;
      if (!pairs.includes(key)) return;
      (byPair[key] ||= []).push(t);
    });
    Object.values(byPair).forEach((txns) => {
      let bal = 0;
      txns.forEach((t) => {
        const before = bal;
        if (t.to_state === "with_customer") bal += Number(t.quantity);
        else if (t.from_state === "with_customer") bal -= Number(t.quantity);
        runningBalance[t.id] = { before, after: bal };
      });
    });
  }

  const expectedByProduct = {};
  bySize.forEach((s) => { expectedByProduct[s.product_id] = Number(s.warehouse); });
  const lastReconByProduct = {};
  (reconHistory || []).forEach((r) => { if (!lastReconByProduct[r.product_id]) lastReconByProduct[r.product_id] = r.recon_date; });
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - UNRECONCILED_DAYS);
  const unreconciled = (products || []).filter((p) => !lastReconByProduct[p.id] || new Date(lastReconByProduct[p.id]) < cutoff);

  // One column per active bottle size — "19L Opening", "6L Opening", etc.
  const bottleOpeningFields = [
    { key: "Customer ID", label: "Customer ID", required: false },
    { key: "Customer", label: "Customer", required: true },
    ...(products || []).map((p) => ({ key: `${p.size_label} Opening`, label: `${p.size_label} Opening`, required: false })),
  ];
  const bottleOpeningSample = { "Customer ID": "", Customer: "Ali Traders" };
  (products || []).forEach((p) => { bottleOpeningSample[`${p.size_label} Opening`] = 0; });

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
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <h2 className="font-display text-2xl font-semibold">Bottle Inventory</h2>
        <Link href="/bottles" className="no-print text-xs font-semibold text-aqua hover:underline">Customer-wise balances →</Link>
      </div>
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
        <Stat label="Total Owned" value={totalOwned} />
        <Stat label="Full Available" value={full} />
        <Stat label="Warehouse" value={warehouseTotal} />
        <Stat label="With Delivery Boys" value={withRiderTotal} />
        <Stat label="With Customers" value={withCustomers} />
        <Stat label="Damaged" value={damagedTotal} />
        <Stat label="Lost" value={lostTotal} />
        <Stat label="Bottle Liability Value" value={pkr(liabilityValue)} sub={`@ ${pkr(BOTTLE_COST)}/bottle avg. replacement cost`} />
      </div>

      <div className="no-print flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <h4 className="text-sm font-bold">By bottle size</h4>
        <div className="flex gap-2">
          {(products || []).length > 0 && (
            <BulkImportButton
              label="Import Opening Balances"
              columnsHint={`Customer ID or Customer*, ${(products || []).map((p) => `${p.size_label} Opening`).join(", ")}`}
              action={bulkImportBottleOpeningBalances}
              sampleRow={bottleOpeningSample}
              previewType="bottleOpening"
              expectedFields={bottleOpeningFields}
            />
          )}
          {(products || []).length > 0 && <BottleReconciliationForm products={products} expectedByProduct={expectedByProduct} />}
        </div>
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl mb-4">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Size</Th><Th>Warehouse</Th><Th>With Delivery Boys</Th><Th>With Customers</Th><Th>Damaged</Th><Th>Lost</Th><Th>Total</Th></tr></thead>
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

      {unreconciled.length > 0 && (
        <p className="text-xs text-amber mb-6 flex items-center gap-1.5"><AlertTriangle size={13} /> Not reconciled in the last {UNRECONCILED_DAYS} days: {unreconciled.map((p) => p.name).join(", ")}.</p>
      )}

      <h4 className="text-sm font-bold mb-2.5">Reconciliation history</h4>
      <div className="overflow-x-auto border border-line rounded-2xl mb-6">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Size</Th><Th>Expected</Th><Th>Physical</Th><Th>Difference</Th><Th>Reason</Th></tr></thead>
          <tbody>
            {(reconHistory || []).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No reconciliations recorded yet.</td></tr>}
            {(reconHistory || []).map((r) => (
              <tr key={r.id} className="hover:bg-foam">
                <Td>{fmtDate(r.recon_date)}</Td><Td>{r.products?.name || "—"}</Td>
                <Td>{r.expected_qty}</Td><Td>{r.physical_qty}</Td>
                <Td className={r.difference < 0 ? "text-coral font-semibold" : r.difference > 0 ? "text-amber font-semibold" : ""}>
                  {r.difference > 0 ? `+${r.difference}` : r.difference}
                </Td>
                <Td className="max-w-[220px] truncate">{r.reason || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="text-sm font-bold mb-2.5">Activity timeline</h4>
      <div className="no-print flex gap-2.5 mb-3">
        <ExportExcelButton rows={exportRows} filename="bottle-ledger.xlsx" sheetName="Bottle Ledger" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Type</Th><Th>Customer</Th><Th>Size</Th><Th>Qty</Th><Th>Before</Th><Th>After</Th><Th>Who</Th><Th>Reason</Th></tr></thead>
          <tbody>
            {(movements || []).length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate">No movements recorded yet.</td></tr>}
            {(movements || []).map((m) => {
              const rb = runningBalance[m.id];
              const type = movementType(m);
              return (
                <tr key={m.id} className="hover:bg-foam">
                  <Td>{fmtDate(m.txn_date)}</Td>
                  <Td><Badge text={type.text} tone={type.tone} /></Td>
                  <Td>{m.customers?.name || "—"}</Td><Td>{m.products?.name || "—"}</Td><Td>{m.quantity}</Td>
                  <Td className="text-slate">{rb ? rb.before : "—"}</Td>
                  <Td className="font-semibold">{rb ? rb.after : "—"}</Td>
                  <Td>{m.profiles?.full_name || "—"}</Td>
                  <Td className="max-w-[160px] truncate">{m.remarks || "—"}</Td>
                </tr>
              );
            })}
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
