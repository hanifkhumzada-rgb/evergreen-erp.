"use client";
import { useState, useRef } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { createExpense, correctWaterExpense } from "@/app/actions";
import Toast from "@/components/Toast";
import { useOfflineSubmit } from "@/lib/useOfflineSubmit";

const CATS = ["Bottle Purchase","Caps","Delivery Expenses","Electricity","Fuel","Labour","Marketing","Office","Packaging","Rent","Repairs","Salaries","Vehicle Maintenance","Other"];

export default function AddExpenseForm({ initialOpen = false, expense = null, categories = [] }) {
  const [open, setOpen] = useState(initialOpen);
  const [toast, setToast] = useState(null);
  const [correcting, setCorrecting] = useState(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(expense);
  const categoryOptions = categories.length ? categories : CATS.map((name) => ({ name }));
  const formRef = useRef();
  const { submit, busy } = useOfflineSubmit("expense", createExpense, {
    label: (payload) => `Expense — ${payload.category || "Other"}`,
  });
  const handleSubmit = async (formData) => {
    setError("");
    setCorrecting(isEdit);
    try {
      const res = isEdit ? await correctWaterExpense(expense.id, formData) : await submit(formData);
      if (res?.error) { setError(res.error); return; }
      setOpen(false);
      formRef.current?.reset();
      setToast({ type: "success", message: res?.offline ? "Saved offline — will sync when back online." : isEdit ? "Expense corrected. Replacement is pending approval." : res?.pendingApproval ? "Expense submitted for approval." : "Expense added." });
    } catch {
      setError("Something went wrong — please try again.");
    } finally { setCorrecting(false); }
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold">{isEdit ? <Pencil size={14} /> : <Plus size={15} />} {isEdit ? "Edit" : "Add Expense"}</button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><h3 className="font-display text-lg font-semibold">{isEdit ? "Correct Expense" : "Add Expense"}</h3><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div>
            {error && <p role="alert" className="mb-3 rounded-xl bg-coralSoft p-3 text-xs text-coral">{error}</p>}
            {isEdit && <p className="mb-3 rounded-xl bg-amberSoft p-3 text-xs text-amber">The old expense is voided/reversed; the corrected entry waits for approval. History is preserved.</p>}
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Category</span>
              <select name={isEdit ? "category_id" : "category"} required defaultValue={isEdit ? expense.category_id : undefined} className="in">{categoryOptions.map((c) => <option key={c.id || c.name} value={isEdit ? c.id : c.name}>{c.name}</option>)}</select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Description</span><input name="description" defaultValue={expense?.description || ""} className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Amount (PKR)</span><input name="amount" type="number" min="0.01" step="0.01" defaultValue={expense?.amount || ""} required className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Method</span>
              <select name="method" defaultValue={expense?.payment_method === "bank" ? "Bank Transfer" : "Cash"} className="in"><option>Cash</option><option>Bank Transfer</option></select>
            </label>
            <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1">Receipt / attachment reference (optional)</span>
              <input name="receipt_reference" defaultValue={expense?.receipt_reference || ""} className="in" placeholder="Receipt no. or URL" />
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Expense date *</span><input name="expense_date" type="date" required defaultValue={expense?.expense_date || new Date().toISOString().slice(0, 10)} className="in" /></label>
            {isEdit && <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Correction reason *</span><textarea name="reason" required minLength={3} className="in" /></label>}
            <button type="submit" disabled={busy || correcting} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy || correcting ? "Saving…" : isEdit ? "Save Correction" : "Save Expense"}</button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
