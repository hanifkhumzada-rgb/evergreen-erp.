"use client";
import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { correctWaterDelivery } from "@/app/actions";
import Toast from "@/components/Toast";

export default function DeliveryCorrectionForm({ delivery, products = [] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(false);
  const submit = async (data) => {
    setBusy(true); setError("");
    const items = (delivery.delivery_items || []).map((item, index) => ({
      product_id: item.product_id,
      delivered_qty: Number(data.get(`delivered_${index}`)),
      returned_qty: Number(data.get(`returned_${index}`)),
    }));
    try {
      const result = await correctWaterDelivery(delivery.id, items, data.get("reason"));
      if (result?.error) { setError(result.error); return; }
      setOpen(false); setToast(true);
    } catch { setError("Could not save correction. Please try again."); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-aqua"><Pencil size={13} />Edit</button>
    {open && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Correct delivery">
      <form action={submit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-lg font-bold">Correct Delivery</h3><button type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="Close correction"><X size={18} /></button></div>
        <p className="mb-3 text-xs text-slate">{delivery.delivery_no} · {delivery.customers?.name || delivery.customer_name} · {delivery.delivery_date || ""}</p>
        <p className="mb-3 rounded-xl bg-aquaSoft p-3 text-xs text-slate">Rate and date are preserved. Quantity changes post linked bottle/ledger adjustments; collection receipts are not overwritten.</p>
        {error && <p role="alert" className="mb-3 rounded-xl bg-coralSoft p-3 text-xs text-coral">{error}</p>}
        {(delivery.delivery_items || []).map((item, index) => <div key={item.product_id} className="mb-3 rounded-xl border border-line p-3">
          <p className="mb-2 text-xs font-bold">{products.find((p) => p.id === item.product_id)?.name || item.product_name || "Bottle"}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate">Delivered *<input className="in mt-1" name={`delivered_${index}`} type="number" min={1} step={1} required defaultValue={item.delivered_qty} /></label>
            <label className="text-xs text-slate">Empty returned<input className="in mt-1" name={`returned_${index}`} type="number" min={0} step={1} required defaultValue={item.returned_qty || 0} /></label>
          </div>
        </div>)}
        <label className="mb-3 block text-xs text-slate">Correction reason *<textarea name="reason" className="in mt-1" required minLength={3} /></label>
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-aqua py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Saving…" : "Save Correction"}</button>
      </form>
    </div>}
    {toast && <Toast type="success" message="Delivery corrected; bottle and ledger adjustments recorded." onDismiss={() => setToast(false)} />}
  </>;
}
