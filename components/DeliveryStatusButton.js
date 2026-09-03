"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { updateDeliveryStatus } from "@/app/actions";
import Toast from "@/components/Toast";

export default function DeliveryStatusButton({ deliveryId, status, label, tone = "coral" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const toneClass = tone === "coral" ? "border-coral text-coral" : "border-amber text-amber";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-card text-xs font-semibold ${toneClass}`}>
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-line bg-card w-full sm:w-64">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold">{label} — note</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel"><X size={14} /></button>
      </div>
      <textarea
        value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / note (optional)" rows={2}
        className="w-full px-2 py-1.5 rounded-lg border border-line bg-card text-ink text-xs outline-none"
      />
      <button type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await updateDeliveryStatus(deliveryId, status, note);
          setBusy(false);
          if (res?.error) { setToast({ type: "error", message: res.error }); return; }
          setOpen(false);
          setToast({ type: "success", message: `Delivery marked ${label.toLowerCase()}.` });
        }}
        className="px-3 py-2 rounded-xl bg-navy text-white text-xs font-semibold disabled:opacity-60"
      >
        {busy ? "Saving…" : "Confirm"}
      </button>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
