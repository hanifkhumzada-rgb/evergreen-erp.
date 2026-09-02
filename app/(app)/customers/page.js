import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pkr } from "@/lib/format";
import { Badge, ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import CustomerForm from "@/components/CustomerForm";
import ImportExcelButton from "@/components/ImportExcelButton";

export const dynamic = "force-dynamic";

const STATUS_BADGE = {
  active: { text: "Active", tone: "green" },
  inactive: { text: "Inactive", tone: "slate" },
  on_hold: { text: "On Hold", tone: "amber" },
  blacklisted: { text: "Blacklisted", tone: "coral" },
};

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: customers }, { data: zones }, { data: balances }, { data: products }, { data: vehicles }, { data: riders }, { data: profile }] = await Promise.all([
    supabase.from("customers").select("*, zones(name)").order("created_at", { ascending: false }),
    supabase.from("zones").select("*"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("vehicles").select("id, registration_no").eq("is_active", true).order("registration_no"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").eq("roles.key", "rider").eq("is_active", true).order("full_name"),
    supabase.from("profiles").select("roles(key)").eq("id", user.id).single(),
  ]);

  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const rows = (customers || []).map((c) => ({ ...c, balance: balanceMap[c.id] || 0 }));
  const canManageFinancial = ["owner", "admin"].includes(profile?.roles?.key);

  const exportRows = rows.map((c) => ({
    Name: c.name, Phone: c.mobile, Zone: c.zones?.name, Type: c.customer_type, Balance: c.balance, Status: STATUS_BADGE[c.status]?.text || (c.is_active ? "Active" : "Inactive"),
  }));

  const formProps = { zones: zones || [], products: products || [], vehicles: vehicles || [], riders: riders || [], canManageFinancial };

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Customers</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ImportExcelButton />
        <ExportExcelButton rows={exportRows} filename="evergreen-customers.xlsx" sheetName="Customers" />
        <PrintButton />
        <CustomerForm mode="create" {...formProps} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Name</Th><Th>Phone</Th><Th>Zone</Th><Th>Type</Th><Th>Balance</Th><Th>Status</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No customers yet.</td></tr>}
            {rows.map((c) => {
              const badge = STATUS_BADGE[c.status] || (c.is_active ? STATUS_BADGE.active : STATUS_BADGE.inactive);
              return (
                <tr key={c.id} className="hover:bg-foam">
                  <Td><Link href={`/customers/${c.id}`} className="font-semibold text-navy hover:text-aqua">{c.name}</Link></Td>
                  <Td>{c.mobile}</Td>
                  <Td>{c.zones?.name || "—"}</Td>
                  <Td>{c.customer_type}</Td>
                  <Td><span className={c.balance > 0 ? "text-coral font-semibold" : "text-green font-semibold"}>{pkr(c.balance)}</span></Td>
                  <Td><Badge text={badge.text} tone={badge.tone} /></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
