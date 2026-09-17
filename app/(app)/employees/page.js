import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { DocumentActionBar, Th, Td, KPI } from "@/components/ui";
import EmployeeAdvanceForm from "@/components/EmployeeAdvanceForm";
import EmployeeEditForm from "@/components/EmployeeEditForm";
import AttendanceButtons from "@/components/AttendanceButtons";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";

export const dynamic = "force-dynamic";

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default async function EmployeesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || "").trim().toLowerCase();
  const supabase = await createClient();
  const today = todayISO();
  const [branding, { data: employees }, { data: deliveries }, { data: zones }, { data: vehicles }, { data: advances }, { data: attendanceToday }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("profiles").select("*, roles!inner(name, key), zones(name), vehicles(registration_no)").neq("roles.key", "customer"),
    supabase.from("deliveries").select("rider_id, status, amount_collected").eq("delivery_date", today),
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
  // KPIs always reflect the whole team, even while a search narrows the
  // table below — searching shouldn't make "Active team"/"Present today" look wrong.
  const presentCount = perf.filter((e) => e.attendanceToday === "present").length;
  const assignedToday = perf.reduce((sum, e) => sum + e.assigned, 0);
  const completedToday = perf.reduce((sum, e) => sum + e.done, 0);
  const cashToday = perf.reduce((sum, e) => sum + e.cash, 0);
  const visible = q
    ? perf.filter((e) =>
        e.full_name?.toLowerCase().includes(q) ||
        e.employee_code?.toLowerCase().includes(q) ||
        e.phone?.toLowerCase().includes(q) ||
        e.role_name?.toLowerCase().includes(q) ||
        e.zones?.name?.toLowerCase().includes(q) ||
        e.vehicles?.registration_no?.toLowerCase().includes(q))
    : perf;

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Employees" meta={`${perf.length} employees\nGenerated ${fmtDate(today)}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Team Command Center</h2>
      <p className="no-print mb-5 text-sm text-slate">Attendance, route execution, cash collection and employee accounts—focused on today.</p>
      <div className="no-print mb-5 flex flex-wrap gap-3.5"><KPI label="ACTIVE TEAM" value={perf.filter((e) => e.is_active).length} tone="navy"/><KPI label="PRESENT TODAY" value={presentCount} tone="green"/><KPI label="DELIVERIES" value={`${completedToday}/${assignedToday}`} tone="aqua" sub="completed / assigned"/><KPI label="CASH COLLECTED" value={pkr(cashToday)} tone="green"/></div>
      {/* Kept as a sibling form, not nested with the toolbar below — a button
          without an explicit type inside another form submits/reloads instead
          of doing its own action. */}
      <form className="no-print flex flex-wrap gap-2.5 mb-2.5 items-center" action="/employees">
        <input type="text" name="q" defaultValue={sp.q || ""} placeholder="Search name, ID, phone, role, zone, vehicle…" className="in w-72" />
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Search</button>
        {q && <Link href="/employees" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <EmployeeAdvanceForm employees={perf} />
        <DocumentActionBar
          print
          excel={{ rows: exportRows, sheetName: "Employees", reportTitle: "Employees", branding }}
          share={{ title: "Employees" }}
        />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Name</Th><Th>ID</Th><Th>Role</Th><Th>Mobile</Th><Th>Joining Date</Th><Th>Zone</Th><Th>Vehicle</Th><Th>Deliveries</Th><Th>Cash Collected</Th><Th>Advance Due</Th><Th>Today</Th><Th></Th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={12} className="text-center py-8 text-slate">No employees match.</td></tr>}
            {visible.map((e) => (
              <tr key={e.id} className="hover:bg-foam">
                <Td><Link href={`/employees/${e.id}`} className="font-semibold text-navy hover:text-aqua">{e.full_name}</Link></Td>
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
      <DocumentPrintFooter />
    </div>
  );
}
