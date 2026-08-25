import { createClient } from "@/lib/supabase/server";
import { Badge, ExportExcelButton, PrintButton, Th, Td, pkr } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: stock }, { data: prices }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("v_bottle_reconciliation").select("product_id, warehouse"),
    supabase.from("product_prices").select("product_id, price"),
  ]);

  const stockMap = {};
  (stock || []).forEach((s) => { stockMap[s.product_id] = Number(s.warehouse); });
  const priceMap = {};
  (prices || []).forEach((p) => { priceMap[p.product_id] = Number(p.price); });

  const rows = (products || []).map((p) => ({ ...p, currentStock: stockMap[p.id] || 0, price: priceMap[p.id] || 0 }));
  const exportRows = rows.map(({ id, is_active, created_at, ...r }) => r);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Inventory</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="evergreen-inventory.xlsx" sheetName="Inventory" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Product</Th><Th>Unit</Th><Th>Current Stock</Th><Th>Reorder Level</Th><Th>Price</Th><Th>Status</Th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-foam">
                <Td className="font-semibold">{p.name}</Td><Td>{p.unit}</Td><Td>{p.currentStock}</Td><Td>{p.low_stock_threshold}</Td><Td>{pkr(p.price)}</Td>
                <Td>{p.currentStock < p.low_stock_threshold ? <Badge text="Low stock — reorder" tone="coral" /> : <Badge text="OK" tone="green" />}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
