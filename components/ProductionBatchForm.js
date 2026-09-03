"use client";
import { useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createProductionBatch } from "@/app/actions";
import { pkr } from "@/lib/format";
import Toast from "@/components/Toast";

export default function ProductionBatchForm({ products }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState(0);
  const [cost, setCost] = useState(0);
  const formRef = useRef();
  const total = useMemo(() => Number(qty || 0) * Number(cost || 0), [qty, cost]);

  const handleSubmit = async (formData) => {
    setError("");
    setBusy(true);
    const res = await createProductionBatch(formData);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    formRef.current?.reset();
    setQty(0); setCost(0);
    setToast({ type: "success", message: "Production batch recorded." });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold">
        <Plus size={15} /> New Batch
      </button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-md w-full max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-semibold">New Production Batch</h3>
              <button type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            {error && <p className="text-coral text-xs mb-3">{error}</p>}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Bottle size *</span>
                <select name="product_id" required className="in">
                  {(products || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Date</span>
                <input name="batch_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="in" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Quantity filled *</span>
                <input name="quantity_filled" type="number" min={1} required className="in" value={qty} onChange={(e) => setQty(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Cost per bottle (PKR) *</span>
                <input name="cost_per_bottle" type="number" min={0} step="0.01" required className="in" value={cost} onChange={(e) => setCost(e.target.value)} />
              </label>
            </div>
            <p className="text-xs text-slate mb-3 -mt-1">Total filling cost: <strong className="text-ink">{pkr(total)}</strong></p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Caps quantity</span>
                <input name="caps_quantity" type="number" min={0} className="in" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Cap cost (PKR)</span>
                <input name="cap_cost" type="number" min={0} step="0.01" className="in" />
              </label>
            </div>
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Other filling material cost (PKR)</span>
              <input name="other_material_cost" type="number" min={0} step="0.01" defaultValue={0} className="in" />
            </label>
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Supplier / source</span>
              <input name="supplier" className="in" />
            </label>
            <label className="block mb-4">
              <span className="text-xs font-semibold text-slate block mb-1">Notes</span>
              <textarea name="notes" rows={2} className="in" />
            </label>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
              {busy ? "Saving…" : "Save Batch"}
            </button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
