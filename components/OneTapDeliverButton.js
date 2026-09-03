"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, CheckCheck } from "lucide-react";
import { createDelivery, skipTodayDelivery } from "@/app/actions";
import Toast from "@/components/Toast";

const ICONS = { repeat: RotateCcw, complete: CheckCheck };

// "Repeat Last Delivery" and one-tap "Complete" — both post through the
// same createDelivery action as the full Deliver sheet (same ledger/
// payment/bottle cascade, same duplicate-submission guard), just with the
// form values already decided instead of asking the rider to re-enter them.
export default function OneTapDeliverButton({ variant, label, customer, deliveredQty, returnedQty, cashCollected, currentUserId }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const router = useRouter();
  const Icon = ICONS[variant] || CheckCheck;

  const handleClick = async () => {
    setBusy(true);
    const fd = new FormData();
    fd.set("customer_id", customer.id);
    fd.set("product_id", customer.defaultProductId || "");
    fd.set("delivered_qty", String(deliveredQty));
    fd.set("returned_qty", String(returnedQty));
    fd.set("cash_collected", String(cashCollected));
    fd.set("delivery_date", new Date().toISOString().slice(0, 10));
    fd.set("rider_id", currentUserId);
    const res = await createDelivery(fd);
    setBusy(false);
    if (res?.error) { setToast({ type: "error", message: res.error }); return; }
    setToast({ type: "success", message: res?.duplicate ? "Already recorded — skipped duplicate submission." : "Delivery recorded." });
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={handleClick} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-card text-xs font-semibold disabled:opacity-60">
        <Icon size={14} /> {busy ? "Saving…" : label}
      </button>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}

export function SkipDeliveryButton({ customerId }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const router = useRouter();

  const handleClick = async () => {
    setBusy(true);
    const res = await skipTodayDelivery(customerId, "");
    setBusy(false);
    if (res?.error) { setToast({ type: "error", message: res.error }); return; }
    setToast({ type: "success", message: "Marked skipped." });
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={handleClick} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-coral bg-card text-xs font-semibold disabled:opacity-60">
        {busy ? "…" : "Skip"}
      </button>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
