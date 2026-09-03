"use client";
import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { createPayment } from "@/app/actions";
import Toast from "@/components/Toast";

export default function AddPaymentForm({ customers, collectors = [], initialCustomerId }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef();

  // "Collect Payment" quick action elsewhere links here with ?customer=<id>
  // — open pre-selected instead of making the caller duplicate this form.
  useEffect(() => {
    if (initialCustomerId) setOpen(true);
  }, [initialCustomerId]);
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
      <button onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold"><Plus size={15} /> Record Payment</button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4"><h3 className="font-display text-lg font-semibold">Record Payment</h3><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Customer</span>
              <select name="customer_id" required defaultValue={initialCustomerId || undefined} className="in">{customers.map((c) => <option key={c.id} value={c.id}>{c.name} — outstanding {Math.round(c.balance || 0)}</option>)}</select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Amount (PKR)</span><input name="amount" type="number" required className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Method</span>
              <select name="method" className="in"><option>Cash</option><option>Bank Transfer</option><option>JazzCash</option><option>Easypaisa</option></select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Collector (who collected the cash)</span>
              <select name="collector_id" className="in">
                <option value="">Me</option>
                {collectors.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </label>
            <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1">Notes (optional)</span>
              <input name="notes" className="in" placeholder="Reference / receipt no. / remarks" />
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
