import { createClient } from "@/lib/supabase/server";
import { pkr } from "@/lib/format";
import { Badge, ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import { AddVehicleForm, AddVehicleExpenseForm } from "@/components/FleetForms";
import BulkImportButton from "@/components/BulkImportButton";
import { bulkImportVehicles } from "@/app/actions";

export const dynamic = "force-dynamic";

const EXPIRY_WARNING_DAYS = 30;

export default async function FleetPage() {
  const supabase = await createClient();
  const [{ data: vehicles }, { data: riders }, { data: fuelLogs }, { data: maintLogs }, { data: customers }] = await Promise.all([
    supabase.from("vehicles").select("*, profiles!vehicles_assigned_rider_id_fkey(full_name)"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("vehicle_fuel_logs").select("*, vehicles(registration_no)"),
    supabase.from("vehicle_maintenance_logs").select("*, vehicles(registration_no)"),
    supabase.from("customers").select("assigned_vehicle_id"),
  ]);

  const vehExpenses = [
    ...(fuelLogs || []).map((l) => ({ id: `f-${l.id}`, vehicle_id: l.vehicle_id, vehicles: l.vehicles, category: "Fuel", amount: l.cost, notes: "" })),
    ...(maintLogs || []).map((l) => ({ id: `m-${l.id}`, vehicle_id: l.vehicle_id, vehicles: l.vehicles, category: "Maintenance", amount: l.cost, notes: l.description })),
  ];

  const custCountByVehicle = {};
  (customers || []).forEach((c) => { if (c.assigned_vehicle_id) custCountByVehicle[c.assigned_vehicle_id] = (custCountByVehicle[c.assigned_vehicle_id] || 0) + 1; });
  const soon = new Date(); soon.setDate(soon.getDate() + EXPIRY_WARNING_DAYS);
  const isExpiringSoon = (d) => d && new Date(d) <= soon;

  const withCosts = (vehicles || []).map((v) => ({
    ...v,
    fuelCost: (fuelLogs || []).filter((l) => l.vehicle_id === v.id).reduce((a, l) => a + Number(l.cost), 0),
    maintCost: (maintLogs || []).filter((l) => l.vehicle_id === v.id).reduce((a, l) => a + Number(l.cost), 0),
    totalCost: vehExpenses.filter((e) => e.vehicle_id === v.id).reduce((a, e) => a + Number(e.amount), 0),
    assignedCustomers: custCountByVehicle[v.id] || 0,
  }));
  const exportRows = withCosts.map((v) => ({
    VehicleNo: v.registration_no, Type: v.vehicle_type, Driver: v.profiles?.full_name, FuelCost: v.fuelCost, MaintenanceCost: v.maintCost,
    TotalCost: v.totalCost, InsuranceExpiry: v.insurance_expiry, RegistrationExpiry: v.registration_expiry, Status: v.is_active ? "Active" : "Inactive",
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Fleet Management</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Registration No*, Vehicle Type, Driver (matches an existing rider's name)"
          action={bulkImportVehicles}
          sampleRow={{ "Registration No": "LEA-1234", "Vehicle Type": "Suzuki Bolan", Driver: "" }}
          previewType="vehicles"
        />
        <ExportExcelButton rows={exportRows} filename="fleet-report.xlsx" sheetName="Fleet" />
        <PrintButton />
        {vehicles?.length > 0 && <AddVehicleExpenseForm vehicles={vehicles.map((v) => ({ id: v.id, vehicle_no: v.registration_no }))} />}
        <AddVehicleForm employees={(riders || []).map((r) => ({ id: r.id, name: r.full_name }))} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Vehicle #</Th><Th>Type</Th><Th>Driver</Th><Th>Customers</Th><Th>Fuel Cost</Th><Th>Maintenance Cost</Th><Th>Insurance Expiry</Th><Th>Registration Expiry</Th><Th>Status</Th></tr></thead>
          <tbody>
            {(withCosts || []).length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate">No vehicles yet.</td></tr>}
            {withCosts.map((v) => (
              <tr key={v.id} className="hover:bg-foam">
                <Td className="font-semibold">{v.registration_no}</Td><Td>{v.vehicle_type || "—"}</Td><Td>{v.profiles?.full_name || "Unassigned"}</Td>
                <Td>{v.assignedCustomers}</Td><Td>{pkr(v.fuelCost)}</Td><Td>{pkr(v.maintCost)}</Td>
                <Td className={isExpiringSoon(v.insurance_expiry) ? "text-coral font-semibold" : ""}>{v.insurance_expiry || "—"}</Td>
                <Td className={isExpiringSoon(v.registration_expiry) ? "text-coral font-semibold" : ""}>{v.registration_expiry || "—"}</Td>
                <Td><Badge text={v.is_active ? "Active" : "Inactive"} tone={v.is_active ? "green" : "slate"} /></Td>
              </tr>
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
