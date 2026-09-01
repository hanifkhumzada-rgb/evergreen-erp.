"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { markDelivered } from "@/app/actions";

export default function MarkDeliveredButton({ deliveryId, emptyExpected }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await markDelivered(deliveryId, emptyExpected);
        setBusy(false);
      }}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-aqua text-white text-xs font-semibold disabled:opacity-60"
    >
      <Check size={14} /> {busy ? "Saving…" : "Delivered"}
    </button>
  );
}
