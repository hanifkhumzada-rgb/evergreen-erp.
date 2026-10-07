"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Scale, X, Loader2 } from "lucide-react";
import { postCustomerAdjustment } from "@/app/actions";
import { todayPK } from "@/lib/format";

// New Credit / Debit adjustment for one customer. On success the document
// opens in the Document Viewer.
export default function AdjustmentForm({ customerId, customerName }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const submit = (formData) => {
    setError("");
    start(async () => {
      const res = await postCustomerAdjustment(formData);
      if (res?.error) { setError(res.error); return; }
      setOpen(false);
      router.push(`/customers/adjustments/${res.id}`);
    });
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold text-ink hover:border-aqua/40 hover:bg-aquaSoft/60 hover:text-aqua"><Scale size={14} /> Credit / Debit Adjustment</button>
      {open ? (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-navy/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="New adjustment">
          <form action={submit} className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-2xl sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div><h3 className="font-display text-lg font-semibold">New Adjustment</h3><p className="text-xs text-slate">{customerName}</p></div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-line" aria-label="Close"><X size={16} /></button>
            </div>
            <input type="hidden" name="customer_id" value={customerId} />
            <div className="mb-3 grid grid-cols-2 gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-green has-[:checked]:bg-greenSoft"><input type="radio" name="adjustment_type" value="credit" defaultChecked /> <span><b>Credit</b><span className="block text-[11px] text-slate">reduces balance</span></span></label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line p-3 text-sm has-[:checked]:border-coral has-[:checked]:bg-coralSoft"><input type="radio" name="adjustment_type" value="debit" /> <span><b>Debit</b><span className="block text-[11px] text-slate">adds to balance</span></span></label>
            </div>
            <label className="mb-3 block"><span className="mb-1 block text-xs font-semibold text-slate">Amount (PKR)</span><input name="amount" type="number" min="1" step="any" inputMode="decimal" required className="in" /></label>
            <label className="mb-3 block"><span className="mb-1 block text-xs font-semibold text-slate">Date</span><input name="adjustment_date" type="date" defaultValue={todayPK()} required className="in" /></label>
            <label className="mb-3 block"><span className="mb-1 block text-xs font-semibold text-slate">Reason *</span><textarea name="reason" required minLength={5} rows={3} placeholder="e.g. Leaking bottle replaced — credit for 1 bottle" className="in" /></label>
            <label className="mb-4 block"><span className="mb-1 block text-xs font-semibold text-slate">Reference (optional)</span><input name="reference" placeholder="Invoice / delivery no." className="in" /></label>
            {error ? <p className="mb-3 rounded-lg bg-coralSoft px-3 py-2 text-xs text-coral">{error}</p> : null}
            <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-aqua py-3 text-sm font-bold text-white disabled:opacity-60">{pending ? <Loader2 size={16} className="animate-spin" /> : null} Post Adjustment</button>
            <p className="mt-2 text-[11px] text-slate">Posts to the customer ledger immediately and is recorded in the audit log.</p>
          </form>
        </div>
      ) : null}
    </>
  );
}
