import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { KPI, ExportExcelButton, PrintButton, Th, Td, Badge } from "@/components/ui";
import ProductionBatchForm from "@/components/ProductionBatchForm";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import { voidProductionBatch } from "@/app/actions";

export const dynamic = "force-dynamic";

function batchCost(b) { return Number(b.total_filling_cost || 0) + Number(b.cap_cost || 0) + Number(b.other_material_cost || 0); }

export default async function ProductionPage() {
  const supabase = await createClient();
  const [{ data: batches }, { data: products }, { data: canVoid }] = await Promise.all([
    supabase.from("production_batches").select("*, products(name)").order("batch_date", { ascending: false }).limit(200),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.rpc("fn_has_permission", { perm_key: "production.delete" }),
  ]);

  const allRows = batches || [];
  const rows = allRows.filter((b) => !b.voided);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";
  const todayRows = rows.filter((b) => b.batch_date === today);
  const monthRows = rows.filter((b) => b.batch_date >= monthStart);
  const totalCost = rows.reduce((a, b) => a + batchCost(b), 0);
  const totalBottles = rows.reduce((a, b) => a + Number(b.quantity_filled || 0), 0);
  const exportRows = rows.map((b) => ({
    Date: b.batch_date, Size: b.products?.name, Quantity: b.quantity_filled, CostPerBottle: b.cost_per_bottle,
    FillingCost: b.total_filling_cost, Caps: b.caps_quantity, CapCost: b.cap_cost, OtherMaterial: b.other_material_cost,
    Supplier: b.supplier,
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Production & Filling</h2>
      <p className="text-slate text-sm mb-5">Bottle filling runs, kept separate from general expenses — quantity × cost per bottle, with caps and materials tracked alongside.</p>

      <div className="flex flex-wrap gap-3.5 mb-6">
        <KPI label="TODAY'S PRODUCTION" value={todayRows.reduce((a, b) => a + Number(b.quantity_filled || 0), 0)} tone="navy" sub={`${todayRows.length} batch${todayRows.length === 1 ? "" : "es"}`} />
        <KPI label="THIS MONTH" value={monthRows.reduce((a, b) => a + Number(b.quantity_filled || 0), 0)} tone="aqua" sub={pkr(monthRows.reduce((a, b) => a + batchCost(b), 0))} />
        <KPI label="TOTAL FILLED" value={totalBottles} tone="slate" sub={`${rows.length} batches all-time`} />
        <KPI label="TOTAL COST" value={pkr(totalCost)} tone="coral" sub={totalBottles ? `${pkr(totalCost / totalBottles)}/bottle avg` : undefined} />
      </div>

      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="evergreen-production.xlsx" sheetName="Production" />
        <PrintButton />
        <ProductionBatchForm products={products || []} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Size</Th><Th>Quantity</Th><Th>Cost/Bottle</Th><Th>Filling Cost</Th><Th>Caps</Th><Th>Cap Cost</Th><Th>Other Material</Th><Th>Supplier</Th><Th>Status</Th><Th className="no-print">&nbsp;</Th></tr></thead>
          <tbody>
            {allRows.length === 0 && <tr><td colSpan={11} className="text-center py-8 text-slate">No production batches recorded yet.</td></tr>}
            {allRows.map((b) => (
              <tr key={b.id} className={`hover:bg-foam ${b.voided ? "opacity-60" : ""}`}>
                <Td>{fmtDate(b.batch_date)}</Td><Td>{b.products?.name || "—"}</Td><Td>{b.quantity_filled}</Td>
                <Td>{pkr(b.cost_per_bottle)}</Td><Td className="font-semibold">{pkr(b.total_filling_cost)}</Td>
                <Td>{b.caps_quantity ?? "—"}</Td><Td>{b.cap_cost != null ? pkr(b.cap_cost) : "—"}</Td>
                <Td>{b.other_material_cost != null ? pkr(b.other_material_cost) : "—"}</Td>
                <Td>{b.supplier || "—"}</Td>
                <Td>{b.voided ? <><Badge text="Voided" tone="coral" />{b.void_reason && <div className="text-[10px] text-slate mt-1 max-w-[140px]">{b.void_reason}</div>}</> : <Badge text="Active" tone="green" />}</Td>
                <Td className="no-print">
                  {canVoid && !b.voided && (
                    <ReasonConfirmButton action={voidProductionBatch} id={b.id} label="Void"
                      confirmText={`Void this production batch (${b.products?.name || "batch"})?`}
                      detailText="This can't be undone. It stops counting toward production/cost totals; the record stays for the audit trail."
                      confirmLabel="Confirm Void" busyLabel="Voiding…" />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
