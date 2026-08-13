import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge, ExportExcelButton, PrintButton, Th, Td, pkr } from "@/components/ui";
import AddCustomerForm from "@/components/AddCustomerForm";
import ImportExcelButton from "@/components/ImportExcelButton";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const supabase = await createClient();
  const [{ data: customers }, { data: zones }] = await Promise.all([
    supabase.from("customers").select("*, zones(name)").order("created_at", { ascending: false }),
    supabase.from("zones").select("*"),
  ]);

  const exportRows = (customers || []).map((c) => ({
    Name: c.name, Phone: c.phone, Zone: c.zones?.name, Type: c.customer_type, Balance: c.balance, Status: c.status,
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Customers</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ImportExcelButton />
        <ExportExcelButton rows={exportRows} filename="evergreen-customers.xlsx" sheetName="Customers" />
        <PrintButton />
        <AddCustomerForm zones={zones || []} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Name</Th><Th>Phone</Th><Th>Zone</Th><Th>Type</Th><Th>Balance</Th><Th>Status</Th></tr></thead>
          <tbody>
            {(customers || []).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No customers yet.</td></tr>}
            {(customers || []).map((c) => (
              <tr key={c.id} className="hover:bg-foam">
                <Td><Link href={`/customers/${c.id}`} className="font-semibold text-navy hover:text-aqua">{c.name}</Link></Td>
                <Td>{c.phone}</Td>
                <Td>{c.zones?.name || "—"}</Td>
                <Td>{c.customer_type}</Td>
                <Td><span className={c.balance > 0 ? "text-coral font-semibold" : "text-green font-semibold"}>{pkr(c.balance)}</span></Td>
                <Td><Badge text={c.status} tone={c.status === "Active" ? "green" : c.status === "At Risk" ? "amber" : "slate"} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
