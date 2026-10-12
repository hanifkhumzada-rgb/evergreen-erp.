import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, DocumentActionBar, RecordStamp, Th, Td } from "@/components/ui";
import BulkImportButton from "@/components/BulkImportButton";
import { bulkImportPurchases } from "@/app/actions";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import ListFilterBar from "@/components/ListFilterBar";
import ModulePageHeader from "@/components/ModulePageHeader";
import { TableEmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || "").trim().toLowerCase();
  const supabase = await createClient();
  const [branding, { data: products }, { data: stock }, { data: prices }, { data: purchases }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("products").select("*").order("name"),
    supabase.from("v_bottle_reconciliation").select("product_id, warehouse"),
    supabase.from("product_prices").select("product_id, price"),
    supabase.from("purchases").select("*, suppliers(name), purchase_items(quantity, rate, amount, inventory_items(name)), creator:profiles!purchases_created_by_fkey(full_name)").order("purchase_date", { ascending: false }).limit(50),
  ]);

  const stockMap = {};
  (stock || []).forEach((s) => { stockMap[s.product_id] = Number(s.warehouse); });
  const priceMap = {};
  (prices || []).forEach((p) => { priceMap[p.product_id] = Number(p.price); });

  const rows = (products || []).map((p) => ({ ...p, currentStock: stockMap[p.id] || 0, price: priceMap[p.id] || 0 }));
  const exportRows = rows.map(({ id, is_active, created_at, ...r }) => r);
  const visible = q ? rows.filter((p) => p.name?.toLowerCase().includes(q) || p.unit?.toLowerCase().includes(q)) : rows;

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Inventory" meta={`${rows.length} products\nGenerated ${fmtDate(new Date().toISOString())}`} />
      <ModulePageHeader title="Inventory" description="Products, stock levels, units and selling rates." />
      {/* Kept as a sibling form, not nested with the toolbar below — a button
          without an explicit type inside another form submits/reloads instead
          of doing its own action. */}
      <ListFilterBar className="!mb-2.5" placeholder="Search product, unit…" />
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <DocumentActionBar
          print
          excel={{ rows: exportRows, sheetName: "Inventory", reportTitle: "Inventory", branding }}
          share={{ title: "Inventory" }}
        />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Product</Th><Th>Unit</Th><Th>Current Stock</Th><Th>Reorder Level</Th><Th>Price</Th><Th>Status</Th></tr></thead>
          <tbody>
            {visible.length === 0 && <TableEmptyState colSpan={6} title="No products match" description="Try another product name or unit." filtered />}
            {visible.map((p) => (
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
          previewType="inventory"
        />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Supplier</Th><Th>Item</Th><Th>Qty</Th><Th>Rate</Th><Th>Amount</Th><Th>Details</Th></tr></thead>
          <tbody>
            {(purchases || []).length === 0 && <TableEmptyState colSpan={7} title="No purchases yet" description="Inventory purchases will appear here after they are recorded." compact />}
            {(purchases || []).flatMap((p) => (p.purchase_items || []).map((it, i) => (
              <tr key={p.id + "-" + i} className="hover:bg-foam">
                <Td>{fmtDate(p.purchase_date)}</Td><Td>{p.suppliers?.name}</Td><Td>{it.inventory_items?.name}</Td>
                <Td>{it.quantity}</Td><Td>{pkr(it.rate)}</Td><Td>{pkr(it.amount)}</Td><Td><RecordStamp date={p.created_at} user={p.creator?.full_name} /></Td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <DocumentPrintFooter />
    </div>
  );
}
