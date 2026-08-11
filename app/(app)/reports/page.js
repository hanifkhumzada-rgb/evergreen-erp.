import { createClient } from "@/lib/supabase/server";
import ReportCard from "@/components/ReportCard";
import { FileSpreadsheet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createClient();
  const [{ data: sales }, { data: expenses }, { data: customers }, { data: deliveries }, { data: products }, { data: employees }] = await Promise.all([
    supabase.from("sales").select("*, customers(name)"),
    supabase.from("expenses").select("*"),
    supabase.from("customers").select("*"),
    supabase.from("deliveries").select("*, customers(name), employees(name)"),
    supabase.from("products").select("*"),
    supabase.from("employees").select("*"),
  ]);

  const reports = [
    { name: "Sales Report", rows: (sales || []).map(({ id, customer_id, product_id, created_by, ...r }) => ({ ...r, customer: r.customers?.name })) },
    { name: "Expense Report", rows: (expenses || []).map(({ id, created_by, ...r }) => r) },
    { name: "Customer Ledger", rows: (customers || []).map((c) => ({ Customer: c.name, Balance: c.balance, CreditLimit: c.credit_limit })) },
    { name: "Delivery Report", rows: (deliveries || []).map((d) => ({ Date: d.del_date, Customer: d.customers?.name, DeliveryBoy: d.employees?.name, Qty: d.qty, Status: d.status })) },
    { name: "Bottle Report", rows: (customers || []).map((c) => ({ Customer: c.name, Delivered: c.bottles_delivered, Returned: c.bottles_returned, Balance: c.bottles_delivered - c.bottles_returned })) },
    { name: "Inventory Report", rows: (products || []).map(({ id, active, ...r }) => r) },
    { name: "Employee Performance", rows: (employees || []).map(({ id, user_id, zone_id, ...r }) => r) },
    { name: "Receivables Report", rows: (customers || []).filter((c) => c.balance > 0).map((c) => ({ Customer: c.name, Phone: c.phone, Outstanding: c.balance })) },
  ];

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Reports</h2>
      <p className="text-slate text-sm mb-5">Live Postgres data. Export to Excel, or print to PDF.</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
        {reports.map((r) => <ReportCard key={r.name} name={r.name} rows={r.rows} />)}
      </div>
    </div>
  );
}
