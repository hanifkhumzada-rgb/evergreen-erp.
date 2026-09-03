import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import ProductionBatchForm from "@/components/ProductionBatchForm";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const supabase = await createClient();
  const [{ data: batches }, { data: products }] = await Promise.all([
    supabase.from("production_batches").select("*, products(name)").order("batch_date", { ascending: false }).limit(200),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
  ]);

  const rows = batches || [];
  const totalCost = rows.reduce((a, b) => a + Number(b.total_filling_cost || 0) + Number(b.cap_cost || 0) + Number(b.other_material_cost || 0), 0);
  const totalBottles = rows.reduce((a, b) => a + Number(b.quantity_filled || 0), 0);
  const avgCostPerBottle = totalBottles ? totalCost / totalBottles : 0;
  const exportRows = rows.map((b) => ({
    Date: b.batch_date, Size: b.products?.name, Quantity: b.quantity_filled, CostPerBottle: b.cost_per_bottle,
    FillingCost: b.total_filling_cost, Caps: b.caps_quantity, CapCost: b.cap_cost, OtherMaterial: b.other_material_cost,
    Supplier: b.supplier,
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Production & Filling</h2>
      <p className="text-slate text-sm mb-5">Bottle filling runs, kept separate from general expenses — quantity × cost per bottle, with caps and materials tracked alongside.</p>

      <div className="flex gap-3 flex-wrap mb-6">
        <Stat label="Bottles filled" value={totalBottles} />
        <Stat label="Total production cost" value={pkr(totalCost)} />
        <Stat label="Avg cost / bottle" value={pkr(avgCostPerBottle)} />
        <Stat label="Batches recorded" value={rows.length} />
      </div>

      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="evergreen-production.xlsx" sheetName="Production" />
        <PrintButton />
        <ProductionBatchForm products={products || []} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Size</Th><Th>Quantity</Th><Th>Cost/Bottle</Th><Th>Filling Cost</Th><Th>Caps</Th><Th>Cap Cost</Th><Th>Other Material</Th><Th>Supplier</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate">No production batches recorded yet.</td></tr>}
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-foam">
                <Td>{fmtDate(b.batch_date)}</Td><Td>{b.products?.name || "—"}</Td><Td>{b.quantity_filled}</Td>
                <Td>{pkr(b.cost_per_bottle)}</Td><Td className="font-semibold">{pkr(b.total_filling_cost)}</Td>
                <Td>{b.caps_quantity ?? "—"}</Td><Td>{b.cap_cost != null ? pkr(b.cap_cost) : "—"}</Td>
                <Td>{b.other_material_cost != null ? pkr(b.other_material_cost) : "—"}</Td>
                <Td>{b.supplier || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Stat({ label, value }) {
  return <div className="text-center flex-1 min-w-[140px] border border-line rounded-2xl py-4"><div className="font-mono-num font-bold text-2xl text-aqua">{value}</div><div className="text-xs text-slate mt-1">{label}</div></div>;
}
