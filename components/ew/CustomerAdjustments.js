import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { EwStatusBadge } from "@/components/ew/EwDoc";

// Async Server Component: the customer's Credit/Debit adjustment documents.
// Renders nothing when there are none (or the viewer has no access).
export default async function CustomerAdjustments({ customerId }) {
  const supabase = await createClient();
  const { data } = await supabase.from("customer_adjustments").select("id, adjustment_no, adjustment_date, adjustment_type, amount, reason, status")
    .eq("customer_id", customerId).order("adjustment_date", { ascending: false }).limit(20);
  if (!data?.length) return null;
  return (
    <section className="no-print mt-6">
      <h3 className="mb-2 font-display text-sm font-semibold">Credit / Debit Adjustments</h3>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead><tr className="bg-foam text-left text-[10.5px] uppercase tracking-wide text-slate"><th className="px-3 py-2">No.</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id} className="border-t border-line hover:bg-foam">
                <td className="px-3 py-2"><Link href={`/customers/adjustments/${a.id}`} className="font-semibold text-navy hover:text-aqua">{a.adjustment_no}</Link></td>
                <td className="px-3 py-2">{fmtDate(a.adjustment_date)}</td>
                <td className="px-3 py-2">{a.adjustment_type === "credit" ? "Credit" : "Debit"}</td>
                <td className={`px-3 py-2 text-right font-semibold ${a.adjustment_type === "credit" ? "text-green" : "text-coral"}`}>{pkr(a.amount)}</td>
                <td className="max-w-[260px] truncate px-3 py-2 text-slate" title={a.reason}>{a.reason}</td>
                <td className="px-3 py-2"><EwStatusBadge status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
