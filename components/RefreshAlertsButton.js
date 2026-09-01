"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { refreshAlerts } from "@/app/actions";

export default function RefreshAlertsButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => { setBusy(true); await refreshAlerts(); setBusy(false); }}
      className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-navy text-white text-xs font-semibold disabled:opacity-60"
    >
      <RefreshCw size={14} /> {busy ? "Checking…" : "Refresh Alerts"}
    </button>
  );
}
