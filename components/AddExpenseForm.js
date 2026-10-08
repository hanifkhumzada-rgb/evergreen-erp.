"use client";
import { useState, useRef } from "react";
import { Plus, Pencil } from "lucide-react";
import { createExpense, correctWaterExpense } from "@/app/actions";
import Toast from "@/components/Toast";
import { useOfflineSubmit } from "@/lib/useOfflineSubmit";
import { EntryFormActions, EntryFormHeader, EntrySection, EntrySummary, useUnsavedForm } from "@/components/ProfessionalEntryForm";

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
  const unsaved = useUnsavedForm(open);
  const handleSubmit = async (formData) => {
    const saveAndNew = formData.get("submit_intent") === "save_new";
    setError("");
    setCorrecting(isEdit);
    try {
      const res = isEdit ? await correctWaterExpense(expense.id, formData) : await submit(formData);
      if (res?.error) { setError(res.error); return; }
      unsaved.resetDirty();
      setOpen(isEdit ? false : saveAndNew);
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
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => unsaved.requestClose(() => setOpen(false))}>
          <form ref={formRef} action={handleSubmit} onChange={unsaved.markDirty} onClick={(e) => e.stopPropagation()} className="erp-entry-form rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-w-2xl w-full max-h-[94vh] overflow-y-auto">
            <EntryFormHeader title={isEdit ? "Correct Expense" : "Record Expense"} subtitle={isEdit ? "Correction creates a traceable replacement" : "Voucher and approval entry"} status={isEdit ? "Correction" : "New"} onClose={() => unsaved.requestClose(() => setOpen(false))} onRefresh={() => formRef.current?.reset()} actions={[{ label: "Clear form", onClick: () => formRef.current?.reset() }]} />
            {error && <p role="alert" className="mb-3 rounded-xl bg-coralSoft p-3 text-xs text-coral">{error}</p>}
            {isEdit && <p className="mb-3 rounded-xl bg-amberSoft p-3 text-xs text-amber">The old expense is voided/reversed; the corrected entry waits for approval. History is preserved.</p>}
            <EntrySection title="Main Information" description="Expense category, description and date.">
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Category</span>
              <select name={isEdit ? "category_id" : "category"} required defaultValue={isEdit ? expense.category_id : undefined} className="in">{categoryOptions.map((c) => <option key={c.id || c.name} value={isEdit ? c.id : c.name}>{c.name}</option>)}</select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Description</span><input name="description" defaultValue={expense?.description || ""} className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Amount (PKR)</span><input name="amount" type="number" min="0.01" step="0.01" defaultValue={expense?.amount || ""} required className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Expense date *</span><input name="expense_date" type="date" required defaultValue={expense?.expense_date || new Date().toISOString().slice(0, 10)} className="in" /></label>
            </EntrySection>
            <EntrySection title="Payment & Supporting Reference" description="Add the method and receipt reference for audit.">
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Method</span>
              <select name="method" defaultValue={expense?.payment_method === "bank" ? "Bank Transfer" : "Cash"} className="in"><option>Cash</option><option>Bank Transfer</option><option>Easypaisa</option><option>JazzCash</option><option>Other</option></select>
            </label>
            <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1">Receipt / attachment reference (optional)</span>
              <input name="receipt_reference" defaultValue={expense?.receipt_reference || ""} className="in" placeholder="Receipt no. or URL" />
            </label>
            {isEdit && <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Correction reason *</span><textarea name="reason" required minLength={3} className="in" /></label>}
            </EntrySection>
            <EntrySummary items={[{ label: "Posting", value: isEdit ? "Reverse + Replacement" : "Expense Ledger" }, { label: "Approval", value: isEdit ? "Required" : "Rules Applied" }, { label: "Audit", value: "Date, User, Time" }]} />
            <EntryFormActions busy={busy || correcting} primaryLabel={isEdit ? "Save Correction" : "Save Expense"} allowSaveAndNew={!isEdit} onCancel={() => unsaved.requestClose(() => setOpen(false))} />
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
