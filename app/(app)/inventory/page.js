import { createClient } from "@/lib/supabase/server";
import { Badge, ExportExcelButton, PrintButton, Th, Td, pkr } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = createClient();
  const { data: products } = await supabase.from("products").select("*").order("name");
  const exportRows = (products || []).map(({ id, active, created_at, updated_at, ...r }) => r);

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
            {(products || []).map((p) => (
              <tr key={p.id} className="hover:bg-foam">
                <Td className="font-semibold">{p.name}</Td><Td>{p.unit}</Td><Td>{p.stock}</Td><Td>{p.min_stock}</Td><Td>{pkr(p.price)}</Td>
                <Td>{p.stock < p.min_stock ? <Badge text="Low stock — reorder" tone="coral" /> : <Badge text="OK" tone="green" />}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
