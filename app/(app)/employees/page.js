import { createClient } from "@/lib/supabase/server";
import { ExportExcelButton, PrintButton, Th, Td, pkr } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const [{ data: employees }, { data: deliveries }] = await Promise.all([
    supabase.from("profiles").select("*, roles!inner(name, key)").neq("roles.key", "customer"),
    supabase.from("deliveries").select("rider_id, status, amount_collected"),
  ]);
  const perf = (employees || []).map((e) => {
    const d = (deliveries || []).filter((x) => x.rider_id === e.id);
    return { ...e, role_name: e.roles?.name, assigned: d.length, done: d.filter((x) => x.status === "delivered").length, cash: d.reduce((a, x) => a + Number(x.amount_collected), 0) };
  });
  const exportRows = perf.map((r) => ({ Name: r.full_name, Role: r.role_name, DeliveriesAssigned: r.assigned, Completed: r.done, CashCollected: r.cash }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Employees</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="evergreen-employees.xlsx" sheetName="Employees" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Name</Th><Th>Role</Th><Th>Deliveries Assigned</Th><Th>Completed</Th><Th>Cash Collected</Th></tr></thead>
          <tbody>
            {perf.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate">No employees yet.</td></tr>}
            {perf.map((e) => <tr key={e.id} className="hover:bg-foam"><Td>{e.full_name}</Td><Td>{e.role_name}</Td><Td>{e.assigned}</Td><Td>{e.done}</Td><Td>{pkr(e.cash)}</Td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
