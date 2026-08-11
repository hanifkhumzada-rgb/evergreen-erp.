import { createClient } from "@/lib/supabase/server";
import { Badge, ExportExcelButton, PrintButton, Th, Td, pkr } from "@/components/ui";
import { AddVehicleForm, AddVehicleExpenseForm } from "@/components/FleetForms";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const supabase = createClient();
  const [{ data: vehicles }, { data: employees }, { data: vehExpenses }] = await Promise.all([
    supabase.from("vehicles").select("*, employees(name)"),
    supabase.from("employees").select("id, name"),
    supabase.from("vehicle_expenses").select("*, vehicles(vehicle_no)"),
  ]);

  const withCosts = (vehicles || []).map((v) => ({
    ...v,
    totalCost: (vehExpenses || []).filter((e) => e.vehicle_id === v.id).reduce((a, e) => a + Number(e.amount), 0),
  }));
  const exportRows = withCosts.map((v) => ({ VehicleNo: v.vehicle_no, Type: v.vehicle_type, Driver: v.employees?.name, TotalCost: v.totalCost, Status: v.status }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Fleet Management</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="fleet-report.xlsx" sheetName="Fleet" />
        <PrintButton />
        {vehicles?.length > 0 && <AddVehicleExpenseForm vehicles={vehicles} />}
        <AddVehicleForm employees={employees || []} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Vehicle #</Th><Th>Type</Th><Th>Driver</Th><Th>Total Cost</Th><Th>Status</Th></tr></thead>
          <tbody>
            {(withCosts || []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate">No vehicles yet.</td></tr>}
            {withCosts.map((v) => (
              <tr key={v.id} className="hover:bg-foam"><Td className="font-semibold">{v.vehicle_no}</Td><Td>{v.vehicle_type || "—"}</Td><Td>{v.employees?.name || "Unassigned"}</Td>
                <Td>{pkr(v.totalCost)}</Td><Td><Badge text={v.status} tone={v.status === "Active" ? "green" : "slate"} /></Td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="text-sm font-bold mt-8 mb-2.5">Recent vehicle expenses</h4>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Vehicle</Th><Th>Category</Th><Th>Amount</Th><Th>Notes</Th></tr></thead>
          <tbody>
            {(vehExpenses || []).length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate">No vehicle expenses logged yet.</td></tr>}
            {(vehExpenses || []).map((e) => <tr key={e.id} className="hover:bg-foam"><Td>{e.vehicles?.vehicle_no}</Td><Td>{e.category}</Td><Td>{pkr(e.amount)}</Td><Td>{e.notes}</Td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
