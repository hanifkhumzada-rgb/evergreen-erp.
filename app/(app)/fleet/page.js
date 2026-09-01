import { createClient } from "@/lib/supabase/server";
import { pkr } from "@/lib/format";
import { Badge, ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import { AddVehicleForm, AddVehicleExpenseForm } from "@/components/FleetForms";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const supabase = await createClient();
  const [{ data: vehicles }, { data: riders }, { data: fuelLogs }, { data: maintLogs }] = await Promise.all([
    supabase.from("vehicles").select("*, profiles!vehicles_assigned_rider_id_fkey(full_name)"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("vehicle_fuel_logs").select("*, vehicles(registration_no)"),
    supabase.from("vehicle_maintenance_logs").select("*, vehicles(registration_no)"),
  ]);

  const vehExpenses = [
    ...(fuelLogs || []).map((l) => ({ id: `f-${l.id}`, vehicle_id: l.vehicle_id, vehicles: l.vehicles, category: "Fuel", amount: l.cost, notes: "" })),
    ...(maintLogs || []).map((l) => ({ id: `m-${l.id}`, vehicle_id: l.vehicle_id, vehicles: l.vehicles, category: "Maintenance", amount: l.cost, notes: l.description })),
  ];

  const withCosts = (vehicles || []).map((v) => ({
    ...v,
    totalCost: vehExpenses.filter((e) => e.vehicle_id === v.id).reduce((a, e) => a + Number(e.amount), 0),
  }));
  const exportRows = withCosts.map((v) => ({ VehicleNo: v.registration_no, Type: v.vehicle_type, Driver: v.profiles?.full_name, TotalCost: v.totalCost, Status: v.is_active ? "Active" : "Inactive" }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Fleet Management</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="fleet-report.xlsx" sheetName="Fleet" />
        <PrintButton />
        {vehicles?.length > 0 && <AddVehicleExpenseForm vehicles={vehicles.map((v) => ({ id: v.id, vehicle_no: v.registration_no }))} />}
        <AddVehicleForm employees={(riders || []).map((r) => ({ id: r.id, name: r.full_name }))} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Vehicle #</Th><Th>Type</Th><Th>Driver</Th><Th>Total Cost</Th><Th>Status</Th></tr></thead>
          <tbody>
            {(withCosts || []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate">No vehicles yet.</td></tr>}
            {withCosts.map((v) => (
              <tr key={v.id} className="hover:bg-foam"><Td className="font-semibold">{v.registration_no}</Td><Td>{v.vehicle_type || "—"}</Td><Td>{v.profiles?.full_name || "Unassigned"}</Td>
                <Td>{pkr(v.totalCost)}</Td><Td><Badge text={v.is_active ? "Active" : "Inactive"} tone={v.is_active ? "green" : "slate"} /></Td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="text-sm font-bold mt-8 mb-2.5">Recent vehicle expenses</h4>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Vehicle</Th><Th>Category</Th><Th>Amount</Th><Th>Notes</Th></tr></thead>
          <tbody>
            {vehExpenses.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate">No vehicle expenses logged yet.</td></tr>}
            {vehExpenses.map((e) => <tr key={e.id} className="hover:bg-foam"><Td>{e.vehicles?.registration_no}</Td><Td>{e.category}</Td><Td>{pkr(e.amount)}</Td><Td>{e.notes}</Td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
