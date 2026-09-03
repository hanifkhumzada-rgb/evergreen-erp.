"use client";
import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { createExpense } from "@/app/actions";
import Toast from "@/components/Toast";

const CATS = ["Bottle Purchase","Caps","Delivery Expenses","Electricity","Fuel","Labour","Marketing","Office","Packaging","Rent","Repairs","Salaries","Vehicle Maintenance","Other"];

export default function AddExpenseForm() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef();
  const handleSubmit = async (formData) => {
    setBusy(true);
    const res = await createExpense(formData);
    setBusy(false);
    if (res?.error) { setToast({ type: "error", message: res.error }); return; }
    setOpen(false);
    formRef.current?.reset();
    setToast({ type: "success", message: "Expense added." });
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold"><Plus size={15} /> Add Expense</button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><h3 className="font-display text-lg font-semibold">Add Expense</h3><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Category</span>
              <select name="category" className="in">{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Description</span><input name="description" className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Amount (PKR)</span><input name="amount" type="number" required className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Method</span>
              <select name="method" className="in"><option>Cash</option><option>Bank Transfer</option></select>
            </label>
            <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1">Receipt / attachment reference (optional)</span>
              <input name="receipt_reference" className="in" placeholder="Receipt no. or URL" />
            </label>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Saving…" : "Save Expense"}</button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
