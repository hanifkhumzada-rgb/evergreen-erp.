"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, X } from "lucide-react";
import { createPayment } from "@/app/actions";
import Toast from "@/components/Toast";

export default function AddPaymentForm({ customers, collectors = [], initialCustomerId }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [customerId, setCustomerId] = useState(initialCustomerId || "");
  const formRef = useRef();

  // "Collect Payment" quick action elsewhere links here with ?customer=<id>
  // — open pre-selected instead of making the caller duplicate this form.
  useEffect(() => {
    if (initialCustomerId) { setOpen(true); setCustomerId(initialCustomerId); }
  }, [initialCustomerId]);

  const selected = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);

  const handleSubmit = async (formData) => {
    setBusy(true);
    const res = await createPayment(formData);
    setBusy(false);
    if (res?.error) { setToast({ type: "error", message: res.error }); return; }
    setOpen(false);
    formRef.current?.reset();
    setToast({ type: "success", message: "Payment recorded." });
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold"><Plus size={15} /> Collect Payment</button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><h3 className="font-display text-lg font-semibold">Collect Payment</h3><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div>
            <label className="block mb-1"><span className="text-xs font-semibold text-slate block mb-1">Customer</span>
              <select name="customer_id" required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="in">
                <option value="" disabled>— select —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} — outstanding {Math.round(c.balance || 0)}</option>)}
              </select>
            </label>
            {selected?.frequency && <p className="text-[11px] text-slate mb-3">Billing frequency: <strong className="text-ink">{selected.frequency}</strong></p>}
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Amount (PKR)</span><input name="amount" type="number" required className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Method</span>
              <select name="method" className="in"><option>Cash</option><option>Bank Transfer</option><option>JazzCash</option><option>Easypaisa</option></select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Collected by *</span>
              <select name="collector_id" required defaultValue="" className="in">
                <option value="">Me</option>
                {collectors.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Reference (optional)</span>
              <input name="reference" className="in" placeholder="Receipt / transaction no." />
            </label>
            <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1">Notes (optional)</span>
              <input name="notes" className="in" placeholder="Remarks" />
            </label>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Saving…" : "Save Payment"}</button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
