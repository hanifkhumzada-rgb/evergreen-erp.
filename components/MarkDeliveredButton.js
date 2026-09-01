"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { markDelivered } from "@/app/actions";

export default function MarkDeliveredButton({ deliveryId, emptyExpected }) {
  const [open, setOpen] = useState(false);
  const [deliveredQty, setDeliveredQty] = useState(emptyExpected);
  const [emptyReceived, setEmptyReceived] = useState(emptyExpected);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-aqua text-white text-xs font-semibold"
      >
        <Check size={14} /> Delivered
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-line bg-card w-full sm:w-auto">
      <div className="flex gap-2">
        <label className="flex-1 text-[11px] font-semibold text-slate">
          Delivered qty
          <input
            type="number" min={0} value={deliveredQty}
            onChange={(e) => setDeliveredQty(Number(e.target.value))}
            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-line bg-card text-ink text-sm"
          />
        </label>
        <label className="flex-1 text-[11px] font-semibold text-slate">
          Empty collected
          <input
            type="number" min={0} value={emptyReceived}
            onChange={(e) => setEmptyReceived(Number(e.target.value))}
            className="mt-1 w-full px-2 py-1.5 rounded-lg border border-line bg-card text-ink text-sm"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await markDelivered(deliveryId, deliveredQty, emptyReceived);
            setBusy(false);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-aqua text-white text-xs font-semibold disabled:opacity-60"
        >
          <Check size={14} /> {busy ? "Saving…" : "Confirm"}
        </button>
        <button
          disabled={busy}
          onClick={() => setOpen(false)}
          className="px-3 py-2 rounded-xl border border-line bg-card text-xs font-semibold disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
