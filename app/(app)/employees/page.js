import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import EmployeeAdvanceForm from "@/components/EmployeeAdvanceForm";
import EmployeeEditForm from "@/components/EmployeeEditForm";
import AttendanceButtons from "@/components/AttendanceButtons";

export const dynamic = "force-dynamic";

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default async function EmployeesPage() {
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: employees }, { data: deliveries }, { data: zones }, { data: vehicles }, { data: advances }, { data: attendanceToday }] = await Promise.all([
    supabase.from("profiles").select("*, roles!inner(name, key), zones(name), vehicles(registration_no)").neq("roles.key", "customer"),
    supabase.from("deliveries").select("rider_id, status, amount_collected"),
    supabase.from("zones").select("id, name").order("name"),
    supabase.from("vehicles").select("id, registration_no").eq("is_active", true).order("registration_no"),
    supabase.from("employee_advances").select("employee_id, amount, repaid"),
    supabase.from("employee_attendance").select("employee_id, status").eq("attendance_date", today),
  ]);

  const advanceMap = {};
  (advances || []).filter((a) => !a.repaid).forEach((a) => { advanceMap[a.employee_id] = (advanceMap[a.employee_id] || 0) + Number(a.amount); });
  const attendanceMap = {};
  (attendanceToday || []).forEach((a) => { attendanceMap[a.employee_id] = a.status; });

  const perf = (employees || []).map((e) => {
    const d = (deliveries || []).filter((x) => x.rider_id === e.id);
    return {
      ...e, role_name: e.roles?.name, assigned: d.length, done: d.filter((x) => x.status === "delivered").length,
      cash: d.reduce((a, x) => a + Number(x.amount_collected), 0),
      outstandingAdvance: advanceMap[e.id] || 0,
      attendanceToday: attendanceMap[e.id],
    };
  });
  const exportRows = perf.map((r) => ({
    Name: r.full_name, EmployeeID: r.employee_code, Role: r.role_name, Mobile: r.phone, JoiningDate: r.joining_date,
    Zone: r.zones?.name, Vehicle: r.vehicles?.registration_no, Status: r.is_active ? "Active" : "Inactive",
    DeliveriesAssigned: r.assigned, Completed: r.done, CashCollected: r.cash, OutstandingAdvance: r.outstandingAdvance,
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Employees</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <EmployeeAdvanceForm employees={perf} />
        <ExportExcelButton rows={exportRows} filename="evergreen-employees.xlsx" sheetName="Employees" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Name</Th><Th>ID</Th><Th>Role</Th><Th>Mobile</Th><Th>Joining Date</Th><Th>Zone</Th><Th>Vehicle</Th><Th>Deliveries</Th><Th>Cash Collected</Th><Th>Advance Due</Th><Th>Today</Th><Th></Th></tr></thead>
          <tbody>
            {perf.length === 0 && <tr><td colSpan={12} className="text-center py-8 text-slate">No employees yet.</td></tr>}
            {perf.map((e) => (
              <tr key={e.id} className="hover:bg-foam">
                <Td className="font-semibold">{e.full_name}</Td>
                <Td className="font-mono-num text-slate">{e.employee_code || "—"}</Td>
                <Td>{e.role_name}</Td>
                <Td>{e.phone || "—"}</Td>
                <Td>{e.joining_date ? fmtDate(e.joining_date) : "—"}</Td>
                <Td>{e.zones?.name || "—"}</Td>
                <Td>{e.vehicles?.registration_no || "—"}</Td>
                <Td>{e.done}/{e.assigned}</Td>
                <Td>{pkr(e.cash)}</Td>
                <Td className={e.outstandingAdvance > 0 ? "text-amber font-semibold" : ""}>{e.outstandingAdvance > 0 ? pkr(e.outstandingAdvance) : "—"}</Td>
                <Td><AttendanceButtons employeeId={e.id} today={today} initialStatus={e.attendanceToday} /></Td>
                <Td><EmployeeEditForm employee={e} zones={zones || []} vehicles={vehicles || []} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
