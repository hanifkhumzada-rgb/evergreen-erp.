"use client";
import { useState, useRef } from "react";
import { ClipboardCheck, X } from "lucide-react";
import { recordBottleReconciliation } from "@/app/actions";
import Toast from "@/components/Toast";

// Expected count per size is looked up live server-side (from
// v_bottle_reconciliation) so this only shows what the page already passed
// in — staff enter what they actually counted in the warehouse.
export default function BottleReconciliationForm({ products, expectedByProduct }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState(products?.[0]?.id || "");
  const [physicalQty, setPhysicalQty] = useState("");
  const formRef = useRef();

  const expected = expectedByProduct[productId] ?? 0;
  const physical = physicalQty === "" ? null : Number(physicalQty);
  const difference = physical === null ? null : physical - expected;

  const handleSubmit = async (formData) => {
    setError("");
    setBusy(true);
    const res = await recordBottleReconciliation(formData);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    formRef.current?.reset();
    setPhysicalQty("");
    setToast({
      type: res.difference === 0 ? "success" : "error",
      message: res.difference === 0 ? "Reconciled — physical count matches expected." : `Recorded — ${res.difference > 0 ? "excess" : "shortage"} of ${Math.abs(res.difference)} bottles adjusted.`,
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">
        <ClipboardCheck size={14} /> Reconcile
      </button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-semibold">Bottle Reconciliation</h3>
              <button type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            {error && <p className="text-coral text-xs mb-3">{error}</p>}
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Bottle size</span>
              <select name="product_id" required className="in" value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div className="text-xs text-slate mb-3">Expected (warehouse, system count): <span className="font-semibold text-ink">{expected}</span></div>
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Physical count</span>
              <input name="physical_qty" type="number" required className="in" value={physicalQty} onChange={(e) => setPhysicalQty(e.target.value)} />
            </label>
            {difference !== null && difference !== 0 && (
              <p className={`text-xs mb-3 font-semibold ${difference < 0 ? "text-coral" : "text-amber"}`}>
                {difference < 0 ? `Shortage of ${Math.abs(difference)} bottles` : `Excess of ${difference} bottles`} — a reason is required.
              </p>
            )}
            <label className="block mb-4">
              <span className="text-xs font-semibold text-slate block mb-1">Reason {difference ? "*" : "(optional)"}</span>
              <textarea name="reason" rows={2} className="in" placeholder="e.g. warehouse damage found, miscount corrected, theft suspected…" />
            </label>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
              {busy ? "Recording…" : "Record Reconciliation"}
            </button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
