import { createClient } from "@/lib/supabase/server";
import { ExportExcelButton, ExportCsvButton } from "@/components/ui";
import { getBrandingLite } from "@/lib/pdf/business";
import Link from "next/link";
import { FileSpreadsheet, Upload, Truck, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Pending", draft: "Draft", overdue: "Overdue", void: "Void" };

export default async function ExportDataPage() {
  const supabase = await createClient();

  const [
    branding,
    { data: customers }, { data: customerBalances },
    { data: invoices },
    { data: payments },
    { data: expenses },
    { data: products }, { data: stock }, { data: prices },
    { data: bottleMovements },
    { data: ledgerCustomers }, { data: ledgerBalances },
  ] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("customers").select("*, zones(name)").order("created_at", { ascending: false }),
    supabase.from("v_customer_balance").select("customer_id, balance"),
    supabase.from("invoices").select("*, customers(name), invoice_items(quantity)").order("created_at", { ascending: false }).limit(200),
    supabase.from("payments").select("*, customers(name), profiles!payments_received_by_fkey(full_name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("expenses").select("*, expense_categories(name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("products").select("*").order("name"),
    supabase.from("v_bottle_reconciliation").select("product_id, warehouse"),
    supabase.from("product_prices").select("product_id, price"),
    supabase.from("bottle_transactions").select("*, customers(name)").order("created_at", { ascending: false }).limit(150),
    supabase.from("customers").select("*").order("name"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
  ]);

  // Same per-dataset row shapes as the Customers/Sales/Payments/Expenses/
  // Inventory/Bottle Ledger/Customer Ledger pages, just gathered in one place.
  const custBalanceMap = {};
  (customerBalances || []).forEach((b) => { custBalanceMap[b.customer_id] = Number(b.balance); });
  const customerRows = (customers || []).map((c) => ({
    Name: c.name, Phone: c.mobile, Zone: c.zones?.name, Type: c.customer_type, Balance: custBalanceMap[c.id] || 0, Status: c.is_active ? "Active" : "Inactive",
  }));

  const qtyOf = (s) => (s.invoice_items || []).reduce((a, i) => a + Number(i.quantity), 0);
  const salesRows = (invoices || []).map((s) => ({
    Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name, Qty: qtyOf(s), Total: s.net_amount, Status: STATUS_LABEL[s.status] || s.status,
  }));

  const paymentRows = (payments || []).map((p) => ({ Date: p.payment_date, Customer: p.customers?.name, Amount: p.amount, Method: p.method, Collector: p.profiles?.full_name }));

  const expenseRows = (expenses || []).map((e) => ({ Date: e.expense_date, Category: e.expense_categories?.name, Description: e.description, Amount: e.amount, Method: e.payment_method, Status: e.status }));

  const stockMap = {};
  (stock || []).forEach((s) => { stockMap[s.product_id] = Number(s.warehouse); });
  const priceMap = {};
  (prices || []).forEach((p) => { priceMap[p.product_id] = Number(p.price); });
  const inventoryRows = (products || []).map((p) => {
    const { id, is_active, created_at, ...rest } = { ...p, currentStock: stockMap[p.id] || 0, price: priceMap[p.id] || 0 };
    return rest;
  });

  const bottleLedgerRows = (bottleMovements || []).map((m) => ({ Date: m.txn_date, Customer: m.customers?.name, From: m.from_state, To: m.to_state, Qty: m.quantity }));

  const ledgerBalanceMap = {};
  (ledgerBalances || []).forEach((b) => { ledgerBalanceMap[b.customer_id] = Number(b.balance); });
  const customerLedgerRows = (ledgerCustomers || []).map((c) => ({ Customer: c.name, Opening: c.opening_balance, CurrentBalance: ledgerBalanceMap[c.id] || 0, CreditLimit: c.credit_limit }));

  const datasets = [
    { name: "Customers", rows: customerRows, filename: "evergreen-customers.xlsx", sheetName: "Customers" },
    { name: "Sales", rows: salesRows, filename: "evergreen-sales.xlsx", sheetName: "Sales" },
    { name: "Payments", rows: paymentRows, filename: "evergreen-payments.xlsx", sheetName: "Payments" },
    { name: "Expenses", rows: expenseRows, filename: "evergreen-expenses.xlsx", sheetName: "Expenses" },
    { name: "Inventory", rows: inventoryRows, filename: "evergreen-inventory.xlsx", sheetName: "Inventory" },
    { name: "Bottle Ledger", rows: bottleLedgerRows, filename: "bottle-ledger.xlsx", sheetName: "Bottle Ledger" },
    { name: "Customer Ledger", rows: customerLedgerRows, filename: "evergreen-ledger.xlsx", sheetName: "Ledger" },
  ];

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Import / Export Center</h2>
      <p className="text-slate text-sm mb-5">Data ko preview karke import karein, ya CSV aur branded coloured Excel backup download karein.</p>
      <div className="grid sm:grid-cols-2 gap-3 mb-6 max-w-3xl">
        <Link href="/customers" className="rounded-2xl border border-line bg-aquaSoft/50 p-4 flex items-center gap-3 hover:border-aqua/40"><div className="w-10 h-10 rounded-xl bg-card grid place-items-center text-aqua"><Users size={18} /></div><div><p className="text-sm font-semibold">Import Customers</p><p className="text-xs text-slate">Excel/CSV preview, validation and import</p></div><Upload size={16} className="ml-auto text-slate" /></Link>
        <Link href="/deliveries" className="rounded-2xl border border-line bg-aquaSoft/50 p-4 flex items-center gap-3 hover:border-aqua/40"><div className="w-10 h-10 rounded-xl bg-card grid place-items-center text-aqua"><Truck size={18} /></div><div><p className="text-sm font-semibold">Import Deliveries</p><p className="text-xs text-slate">Bulk delivery preview before saving</p></div><Upload size={16} className="ml-auto text-slate" /></Link>
      </div>
      <h3 className="font-display text-lg font-semibold mb-3">Download backups</h3>
      <div className="flex flex-col gap-2 max-w-xl">
        {datasets.map((d) => (
          <div key={d.name} className="flex items-center justify-between border border-line rounded-2xl px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-aquaSoft flex items-center justify-center flex-shrink-0"><FileSpreadsheet size={16} className="text-aqua" /></div>
              <div>
                <div className="text-sm font-semibold">{d.name}</div>
                <div className="text-xs text-slate">{d.rows.length} row{d.rows.length === 1 ? "" : "s"}</div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <ExportCsvButton rows={d.rows} reportTitle={d.name} />
              <ExportExcelButton rows={d.rows} sheetName={d.sheetName} reportTitle={d.name} branding={branding} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
