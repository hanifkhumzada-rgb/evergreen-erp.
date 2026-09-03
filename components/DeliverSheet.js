"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, X } from "lucide-react";
import { createDelivery } from "@/app/actions";
import { pkr } from "@/lib/format";
import Toast from "@/components/Toast";

// The Today's Deliveries workspace's per-customer "Deliver" action — a
// compact bottom sheet (not the centered New Delivery modal) so it reads as
// a fast, mobile-first single-customer action. Rate is always the server-
// computed effective rate carried on `customer`, never a typed field, and
// the sheet posts through the SAME createDelivery action the New Delivery
// form uses (ledger/payment/bottle cascade lives in one place).
export default function DeliverSheet({ customer, riders = [], currentUserId }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef();
  const router = useRouter();

  const defaultQty = customer.regularQty > 0 ? customer.regularQty : 1;
  const [deliveredQty, setDeliveredQty] = useState(defaultQty);
  const [cashCollected, setCashCollected] = useState(Math.round(defaultQty * (customer.rate || 0)));

  const handleSubmit = async (formData) => {
    setError("");
    setBusy(true);
    const res = await createDelivery(formData);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    if (res?.duplicate) {
      setToast({ type: "success", message: "Already recorded — skipped duplicate submission." });
    } else {
      setToast({ type: "success", message: "Delivery recorded." });
    }
    router.refresh();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-aqua text-white text-xs font-semibold">
        <Truck size={14} /> Deliver
      </button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <form
            ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm max-h-[90vh] overflow-y-auto animate-[slideUp_.18s_ease-out]"
          >
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-display text-lg font-semibold">Deliver — {customer.name}</h3>
              <button type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <p className="text-xs text-slate mb-4"><span className="font-mono-num">{customer.code || "—"}</span> · Rate {pkr(customer.rate || 0)} <span className="text-[11px]">(from Customer Master, not editable here)</span></p>
            {error && <p className="text-coral text-xs mb-3">{error}</p>}

            <input type="hidden" name="customer_id" value={customer.id} />
            <input type="hidden" name="product_id" value={customer.defaultProductId || ""} />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Bottles delivered *</span>
                <input
                  name="delivered_qty" type="number" min={1} value={deliveredQty} required className="in"
                  onChange={(e) => { const v = Number(e.target.value) || 0; setDeliveredQty(v); setCashCollected(Math.round(v * (customer.rate || 0))); }}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Empty returned</span>
                <input name="returned_qty" type="number" min={0} defaultValue={defaultQty} className="in" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Cash collected</span>
                <input name="cash_collected" type="number" min={0} step="0.01" value={cashCollected} onChange={(e) => setCashCollected(Number(e.target.value) || 0)} className="in" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Date/Time</span>
                <input name="delivery_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="in" />
              </label>
            </div>

            <label className="block mb-1">
              <span className="text-xs font-semibold text-slate block mb-1">Delivery boy *</span>
              <select name="rider_id" defaultValue={currentUserId || ""} required className="in">
                {!riders.some((r) => r.id === currentUserId) && <option value={currentUserId}>Me</option>}
                {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </label>
            <div className="flex justify-between text-[11px] text-slate mb-4 px-0.5">
              <span>Bottle balance: {customer.bottleBalance ?? 0}</span>
              <span className={customer.outstanding > 0 ? "text-coral" : "text-green"}>Outstanding: {pkr(customer.outstanding || 0)}</span>
            </div>

            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
              {busy ? "Saving…" : "Save Delivery"}
            </button>
          </form>
        </div>
      )}
      <style jsx global>{`
        .in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
