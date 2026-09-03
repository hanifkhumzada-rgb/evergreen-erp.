import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { pkr, fmtDate } from "@/lib/format";
import { KPI, Badge, Th, Td } from "@/components/ui";
import EmployeeEditForm from "@/components/EmployeeEditForm";
import EmployeeAdvanceForm from "@/components/EmployeeAdvanceForm";
import AttendanceButtons from "@/components/AttendanceButtons";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import { deleteEmployeeAdvance, deleteEmployeeAttendance } from "@/app/actions";

export const dynamic = "force-dynamic";

const ATTENDANCE_BADGE = { present: { text: "Present", tone: "green" }, absent: { text: "Absent", tone: "coral" }, leave: { text: "Leave", tone: "amber" } };

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default async function EmployeeProfilePage({ params }) {
  const supabase = await createClient();
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";
  const [
    { data: e }, { data: zones }, { data: vehicles },
    { data: deliveries }, { data: advances }, { data: attendance }, { data: canManage },
  ] = await Promise.all([
    supabase.from("profiles").select("*, roles!inner(name, key), zones(name), vehicles(registration_no)").eq("id", params.id).single(),
    supabase.from("zones").select("id, name").order("name"),
    supabase.from("vehicles").select("id, registration_no").eq("is_active", true).order("registration_no"),
    supabase.from("deliveries").select("delivery_date, status, amount_collected").eq("rider_id", params.id).order("delivery_date", { ascending: false }),
    supabase.from("employee_advances").select("*").eq("employee_id", params.id).order("advance_date", { ascending: false }),
    supabase.from("employee_attendance").select("*").eq("employee_id", params.id).order("attendance_date", { ascending: false }).limit(60),
    supabase.rpc("fn_has_permission", { perm_key: "users.manage" }),
  ]);

  if (!e) {
    return (
      <div>
        <Link href="/employees" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Employees</Link>
        <p>Employee not found.</p>
      </div>
    );
  }

  const assigned = deliveries?.length || 0;
  const completed = (deliveries || []).filter((d) => d.status === "delivered").length;
  const cashCollected = (deliveries || []).reduce((a, d) => a + Number(d.amount_collected || 0), 0);
  const outstandingAdvance = (advances || []).filter((a) => !a.repaid).reduce((a, x) => a + Number(x.amount), 0);

  const monthAttendance = (attendance || []).filter((a) => a.attendance_date >= monthStart);
  const presentDays = monthAttendance.filter((a) => a.status === "present").length;
  const absentDays = monthAttendance.filter((a) => a.status === "absent").length;
  const leaveDays = monthAttendance.filter((a) => a.status === "leave").length;
  const todaysAttendance = (attendance || []).find((a) => a.attendance_date === today);

  return (
    <div>
      <Link href="/employees" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Employees</Link>

      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="font-display text-2xl font-semibold">{e.full_name}</h2>
          <p className="text-slate text-sm mt-1">
            <span className="font-mono-num">{e.employee_code || "—"}</span> · {e.roles?.name} · {e.zones?.name || "No zone"} · {e.is_active ? "Active" : "Inactive"}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <EmployeeEditForm employee={e} zones={zones || []} vehicles={vehicles || []} />
        </div>
      </div>

      <div className="flex gap-x-5 gap-y-1.5 flex-wrap text-[13px] text-slate mb-5">
        {e.phone && <span>{e.phone}</span>}
        {e.joining_date && <span>Joined {fmtDate(e.joining_date)}</span>}
        {e.salary != null && e.salary > 0 && <span>Salary: {pkr(e.salary)}</span>}
        {e.vehicles?.registration_no && <span>Vehicle: {e.vehicles.registration_no}</span>}
      </div>

      <div className="flex flex-wrap gap-3.5 mb-6">
        <KPI label="DELIVERIES" value={`${completed}/${assigned}`} tone="navy" />
        <KPI label="CASH COLLECTED" value={pkr(cashCollected)} tone="green" />
        <KPI label="ADVANCE OUTSTANDING" value={pkr(outstandingAdvance)} tone={outstandingAdvance > 0 ? "amber" : "slate"} />
        <KPI label="ATTENDANCE THIS MONTH" value={`${presentDays}P / ${absentDays}A / ${leaveDays}L`} tone="aqua" />
      </div>

      <div className="flex items-center justify-between mb-2.5">
        <h3 className="font-display text-base font-semibold">Attendance</h3>
        <div className="no-print flex items-center gap-2">
          <span className="text-xs text-slate">Today:</span>
          <AttendanceButtons employeeId={e.id} today={today} initialStatus={todaysAttendance?.status} />
        </div>
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl mb-8">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Status</Th><Th>Notes</Th><Th className="no-print">&nbsp;</Th></tr></thead>
          <tbody>
            {(attendance || []).length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate">No attendance recorded yet.</td></tr>}
            {(attendance || []).map((a) => {
              const badge = ATTENDANCE_BADGE[a.status] || { text: a.status, tone: "slate" };
              return (
                <tr key={a.id} className="hover:bg-foam">
                  <Td>{fmtDate(a.attendance_date)}</Td>
                  <Td><Badge text={badge.text} tone={badge.tone} /></Td>
                  <Td className="text-slate max-w-[240px] truncate">{a.notes || "—"}</Td>
                  <Td className="no-print">
                    {canManage && (
                      <ReasonConfirmButton action={deleteEmployeeAttendance} id={a.id} label="Delete"
                        confirmText={`Delete this attendance record (${fmtDate(a.attendance_date)})?`}
                        detailText="This can't be undone."
                        confirmLabel="Confirm Delete" busyLabel="Deleting…" />
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mb-2.5">
        <h3 className="font-display text-base font-semibold">Advances</h3>
        <div className="no-print"><EmployeeAdvanceForm employees={[{ id: e.id, full_name: e.full_name }]} /></div>
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Amount</Th><Th>Reason</Th><Th>Status</Th><Th className="no-print">&nbsp;</Th></tr></thead>
          <tbody>
            {(advances || []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate">No advances recorded yet.</td></tr>}
            {(advances || []).map((a) => (
              <tr key={a.id} className="hover:bg-foam">
                <Td>{fmtDate(a.advance_date)}</Td>
                <Td className="font-semibold">{pkr(a.amount)}</Td>
                <Td className="text-slate max-w-[240px] truncate">{a.reason || "—"}</Td>
                <Td><Badge text={a.repaid ? "Repaid" : "Outstanding"} tone={a.repaid ? "green" : "amber"} /></Td>
                <Td className="no-print">
                  {canManage && (
                    <ReasonConfirmButton action={deleteEmployeeAdvance} id={a.id} label="Delete"
                      confirmText={`Delete this advance of ${pkr(a.amount)}?`}
                      detailText="This can't be undone."
                      confirmLabel="Confirm Delete" busyLabel="Deleting…" />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
