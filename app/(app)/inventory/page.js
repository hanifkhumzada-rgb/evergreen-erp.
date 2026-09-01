import { createClient } from "@/lib/supabase/server";
import { Badge, ExportExcelButton, PrintButton, Th, Td, pkr, fmtDate } from "@/components/ui";
import BulkImportButton from "@/components/BulkImportButton";
import { bulkImportPurchases } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: stock }, { data: prices }, { data: purchases }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("v_bottle_reconciliation").select("product_id, warehouse"),
    supabase.from("product_prices").select("product_id, price"),
    supabase.from("purchases").select("*, suppliers(name), purchase_items(quantity, rate, amount, inventory_items(name))").order("purchase_date", { ascending: false }).limit(50),
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

      <div className="flex items-center justify-between mt-8 mb-2.5">
        <h4 className="text-sm font-bold">Purchases</h4>
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Supplier, Item, Qty, Rate, Date"
          action={bulkImportPurchases}
          sampleRow={{ Supplier: "AquaCaps Ltd", Item: "Bottle Caps", Qty: 1000, Rate: 2, Date: "2026-08-31" }}
          previewLine={(r) => `${r.Supplier || r.supplier} — ${r.Item || r.item} × ${r.Qty || r.qty}`}
        />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Supplier</Th><Th>Item</Th><Th>Qty</Th><Th>Rate</Th><Th>Amount</Th></tr></thead>
          <tbody>
            {(purchases || []).length === 0 && <tr><td colSpan={6} className="text-center py-6 text-slate">No purchases recorded yet.</td></tr>}
            {(purchases || []).flatMap((p) => (p.purchase_items || []).map((it, i) => (
              <tr key={p.id + "-" + i} className="hover:bg-foam">
                <Td>{fmtDate(p.purchase_date)}</Td><Td>{p.suppliers?.name}</Td><Td>{it.inventory_items?.name}</Td>
                <Td>{it.quantity}</Td><Td>{pkr(it.rate)}</Td><Td>{pkr(it.amount)}</Td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
