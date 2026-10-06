import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, KPI, DocumentActionBar, RecordStamp, Th, Td } from "@/components/ui";
import { AddVehicleForm, AddVehicleExpenseForm, EditVehicleForm } from "@/components/FleetForms";
import ListFilterBar from "@/components/ListFilterBar";
import BulkImportButton from "@/components/BulkImportButton";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import { bulkImportVehicles, deleteVehicle, deleteVehicleExpenseLog } from "@/app/actions";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import { AlertTriangle } from "lucide-react";
import { BulkSelectProvider, SelectAllCheckbox, RowCheckbox } from "@/components/BulkSelect";

export const dynamic = "force-dynamic";

const EXPIRY_WARNING_DAYS = 30;

export default async function FleetPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || "").trim().toLowerCase();
  const supabase = await createClient();
  const [branding, { data: vehicles }, { data: riders }, { data: fuelLogs }, { data: maintLogs }, { data: customers }, { data: canDelete }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("vehicles").select("*, profiles!vehicles_assigned_rider_id_fkey(full_name)"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("vehicle_fuel_logs").select("*, vehicles(registration_no), creator:profiles!vehicle_fuel_logs_created_by_fkey(full_name)"),
    supabase.from("vehicle_maintenance_logs").select("*, vehicles(registration_no), creator:profiles!vehicle_maintenance_logs_created_by_fkey(full_name)"),
    supabase.from("customers").select("assigned_vehicle_id"),
    supabase.rpc("fn_has_permission", { perm_key: "vehicles.delete" }),
  ]);

  const vehExpenses = [
    ...(fuelLogs || []).map((l) => ({ id: `f-${l.id}`, vehicle_id: l.vehicle_id, vehicles: l.vehicles, category: "Fuel", amount: l.cost, notes: "", created_at: l.created_at, creator: l.creator })),
    ...(maintLogs || []).map((l) => ({ id: `m-${l.id}`, vehicle_id: l.vehicle_id, vehicles: l.vehicles, category: "Maintenance", amount: l.cost, notes: l.description, created_at: l.created_at, creator: l.creator })),
  ];

  const custCountByVehicle = {};
  (customers || []).forEach((c) => { if (c.assigned_vehicle_id) custCountByVehicle[c.assigned_vehicle_id] = (custCountByVehicle[c.assigned_vehicle_id] || 0) + 1; });
  const today = new Date();
  const soon = new Date(); soon.setDate(soon.getDate() + EXPIRY_WARNING_DAYS);
  const isExpired = (d) => d && new Date(d) < today;
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
    TotalCost: v.totalCost, InsuranceExpiry: v.insurance_expiry, RegistrationExpiry: v.registration_expiry, ServiceDue: v.service_due_date, Status: v.is_active ? "Active" : "Inactive",
  }));

  // "Needs attention" — any active vehicle with insurance/registration/
  // service due within EXPIRY_WARNING_DAYS or already past due.
  const expiryAlerts = [];
  withCosts.filter((v) => v.is_active).forEach((v) => {
    [["insurance_expiry", "Insurance"], ["registration_expiry", "Registration"], ["service_due_date", "Service"]].forEach(([field, label]) => {
      if (isExpiringSoon(v[field])) expiryAlerts.push({ vehicle: v, label, date: v[field], expired: isExpired(v[field]) });
    });
  });
  expiryAlerts.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const activeCount = withCosts.filter((v) => v.is_active).length;
  const visible = q
    ? withCosts.filter((v) =>
        v.registration_no?.toLowerCase().includes(q) ||
        v.vehicle_type?.toLowerCase().includes(q) ||
        v.profiles?.full_name?.toLowerCase().includes(q))
    : withCosts;
  const expenseQuery = (sp.eq || "").trim().toLowerCase();
  const visibleExpenses = expenseQuery
    ? vehExpenses.filter((e) =>
        e.vehicles?.registration_no?.toLowerCase().includes(expenseQuery) ||
        e.category?.toLowerCase().includes(expenseQuery) ||
        e.notes?.toLowerCase().includes(expenseQuery))
    : vehExpenses;

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Fleet" meta={`${withCosts.length} vehicles\nGenerated ${fmtDate(new Date().toISOString())}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Fleet Management</h2>
      <p className="no-print text-slate text-sm mb-4">Vehicles, drivers, running costs, and expiry tracking.</p>

      <div className="no-print flex flex-wrap gap-3.5 mb-5">
        <KPI label="TOTAL VEHICLES" value={withCosts.length} tone="navy" />
        <KPI label="ACTIVE" value={activeCount} tone="green" />
        <KPI label="EXPIRING SOON" value={expiryAlerts.filter((a) => !a.expired).length} tone={expiryAlerts.length > 0 ? "amber" : "slate"} sub={`within ${EXPIRY_WARNING_DAYS} days`} />
        <KPI label="EXPIRED" value={expiryAlerts.filter((a) => a.expired).length} tone={expiryAlerts.some((a) => a.expired) ? "coral" : "slate"} />
      </div>

      {expiryAlerts.length > 0 && (
        <div className="border border-amber/40 bg-amberSoft rounded-2xl p-4 mb-5">
          <h4 className="text-sm font-bold mb-2 flex items-center gap-1.5 text-amber"><AlertTriangle size={15} /> Needs Attention ({expiryAlerts.length})</h4>
          <div className="flex flex-col gap-1.5">
            {expiryAlerts.map((a, i) => (
              <div key={i} className="text-xs flex justify-between items-center px-3 py-2 rounded-lg bg-card">
                <span className="font-semibold">{a.vehicle.registration_no}</span>
                <span className={a.expired ? "text-coral font-semibold" : "text-amber"}>{a.label} {a.expired ? "expired" : "expires"} {a.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kept as a sibling form, not nested with the toolbar below — a button
          without an explicit type inside another form submits/reloads instead
          of doing its own action. */}
      <ListFilterBar className="!mb-2.5" placeholder="Search vehicle #, type, driver…" />
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Registration No*, Vehicle Type, Driver (matches an existing rider's name)"
          action={bulkImportVehicles}
          sampleRow={{ "Registration No": "LEA-1234", "Vehicle Type": "Suzuki Bolan", Driver: "" }}
          previewType="vehicles"
        />
        <DocumentActionBar
          print
          excel={{ rows: exportRows, sheetName: "Fleet", reportTitle: "Fleet Report", branding }}
          share={{ title: "Fleet Report" }}
        />
        {vehicles?.length > 0 && <AddVehicleExpenseForm vehicles={vehicles.map((v) => ({ id: v.id, vehicle_no: v.registration_no }))} />}
        <AddVehicleForm employees={(riders || []).map((r) => ({ id: r.id, name: r.full_name }))} />
      </div>
      <BulkSelectProvider noun="vehicle" scopeLabel="shown" actions={canDelete ? [{ key: "delete", label: "Delete", icon: "trash", action: deleteVehicle, busyLabel: "Deleting", doneLabel: "Delete", detailText: "Each vehicle is deleted exactly as with the single Delete button. Vehicles still assigned to a customer or driver, or with delivery/expense history, are refused automatically and listed as failed." }] : []}>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam">{canDelete && <Th className="no-print w-10"><SelectAllCheckbox /></Th>}<Th>Vehicle #</Th><Th>Type</Th><Th>Driver</Th><Th>Customers</Th><Th>Fuel Cost</Th><Th>Maintenance Cost</Th><Th>Insurance Expiry</Th><Th>Registration Expiry</Th><Th>Service Due</Th><Th>Status</Th><Th className="no-print"></Th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={canDelete ? 12 : 11} className="text-center py-8 text-slate">No vehicles match.</td></tr>}
            {visible.map((v) => (
              <tr key={v.id} className="hover:bg-foam">
                {canDelete && <Td className="no-print"><RowCheckbox id={v.id} label={v.registration_no} /></Td>}
                <Td className="font-semibold">{v.registration_no}</Td><Td>{v.vehicle_type || "—"}</Td><Td>{v.profiles?.full_name || "Unassigned"}</Td>
                <Td>{v.assignedCustomers}</Td><Td>{pkr(v.fuelCost)}</Td><Td>{pkr(v.maintCost)}</Td>
                <Td className={isExpiringSoon(v.insurance_expiry) ? (isExpired(v.insurance_expiry) ? "text-coral font-semibold" : "text-amber font-semibold") : ""}>{v.insurance_expiry || "—"}</Td>
                <Td className={isExpiringSoon(v.registration_expiry) ? (isExpired(v.registration_expiry) ? "text-coral font-semibold" : "text-amber font-semibold") : ""}>{v.registration_expiry || "—"}</Td>
                <Td className={isExpiringSoon(v.service_due_date) ? (isExpired(v.service_due_date) ? "text-coral font-semibold" : "text-amber font-semibold") : ""}>{v.service_due_date || "—"}</Td>
                <Td><Badge text={v.is_active ? "Active" : "Inactive"} tone={v.is_active ? "green" : "slate"} /></Td>
                <Td className="no-print flex items-center gap-1.5">
                  <EditVehicleForm vehicle={v} employees={(riders || []).map((r) => ({ id: r.id, name: r.full_name }))} />
                  {canDelete && (
                    <ReasonConfirmButton action={deleteVehicle} id={v.id} label="Delete" icon="trash"
                      confirmText={`Permanently delete vehicle ${v.registration_no}?`}
                      detailText="This can't be undone. Blocked automatically if the vehicle is still assigned to a customer, driver, or has delivery/expense history."
                      confirmLabel="Confirm Delete" busyLabel="Deleting…" />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </BulkSelectProvider>

      <h4 className="text-sm font-bold mt-8 mb-2.5">Recent vehicle expenses</h4>
      <ListFilterBar className="!mb-2.5" searchParam="eq" placeholder="Search vehicle #, category, notes…" />
      <BulkSelectProvider noun="expense log" scopeLabel="shown" actions={canDelete ? [{ key: "delete", label: "Delete", icon: "trash", action: deleteVehicleExpenseLog, busyLabel: "Deleting", doneLabel: "Delete" }] : []}>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam">{canDelete && <Th className="no-print w-10"><SelectAllCheckbox /></Th>}<Th>Vehicle</Th><Th>Category</Th><Th>Amount</Th><Th>Notes</Th><Th>Recorded</Th><Th className="no-print"></Th></tr></thead>
          <tbody>
            {visibleExpenses.length === 0 && <tr><td colSpan={canDelete ? 7 : 6} className="text-center py-6 text-slate">{expenseQuery ? "No expenses match." : "No vehicle expenses logged yet."}</td></tr>}
            {visibleExpenses.map((e) => (
              <tr key={e.id} className="hover:bg-foam">
                {canDelete && <Td className="no-print"><RowCheckbox id={e.id} label={`${e.vehicles?.registration_no || "Vehicle"} ${e.category}`} /></Td>}
                <Td>{e.vehicles?.registration_no}</Td><Td>{e.category}</Td><Td>{pkr(e.amount)}</Td><Td>{e.notes}</Td><Td><RecordStamp date={e.created_at} user={e.creator?.full_name} /></Td>
                <Td className="no-print">
                  {canDelete && (
                    <ReasonConfirmButton action={deleteVehicleExpenseLog} id={e.id} label="Delete" icon="trash"
                      confirmText={`Delete this ${e.category.toLowerCase()} entry for ${e.vehicles?.registration_no}?`}
                      detailText="This can't be undone — use this only to correct a mis-entered amount or wrong vehicle."
                      confirmLabel="Confirm Delete" busyLabel="Deleting…" />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </BulkSelectProvider>
      <DocumentPrintFooter />
    </div>
  );
}
