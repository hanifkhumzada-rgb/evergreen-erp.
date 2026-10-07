import Link from "next/link";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";

// Async Server Component: an employee's salary payments, each opening its
// Salary Voucher in the Document Viewer.
export default async function EmployeeSalaries({ employeeId }) {
  const supabase = await createClient();
  const { data } = await supabase.from("employee_salary_records").select("id, period_month, base_salary, advances, deductions, net_paid, paid_date")
    .eq("employee_id", employeeId).order("period_month", { ascending: false }).limit(24);
  return (
    <section className="mt-6">
      <h3 className="mb-2 font-display text-lg font-semibold">Salary Payments</h3>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead><tr className="bg-foam text-left text-[10.5px] uppercase tracking-wide text-slate"><th className="px-3 py-2">Month</th><th className="px-3 py-2 text-right">Basic</th><th className="px-3 py-2 text-right">Advances</th><th className="px-3 py-2 text-right">Deductions</th><th className="px-3 py-2 text-right">Net Paid</th><th className="px-3 py-2">Paid On</th><th className="px-3 py-2">Voucher</th></tr></thead>
          <tbody>
            {!data?.length ? <tr><td colSpan={7} className="py-6 text-center text-slate">No salary payments recorded yet.</td></tr> : data.map((s) => (
              <tr key={s.id} className="border-t border-line hover:bg-foam">
                <td className="px-3 py-2">{s.period_month ? new Date(`${String(s.period_month).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : "—"}</td>
                <td className="px-3 py-2 text-right">{pkr(s.base_salary)}</td><td className="px-3 py-2 text-right">{pkr(s.advances)}</td><td className="px-3 py-2 text-right">{pkr(s.deductions)}</td>
                <td className="px-3 py-2 text-right font-semibold">{pkr(s.net_paid)}</td><td className="px-3 py-2">{fmtDate(s.paid_date)}</td>
                <td className="px-3 py-2"><Link href={`/employees/salary/${s.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-aqua"><FileText size={13} /> View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
