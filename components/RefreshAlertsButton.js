"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { refreshAlerts } from "@/app/actions";

export default function RefreshAlertsButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onClick = async () => {
    setBusy(true);
    setError("");
    try {
      await refreshAlerts();
    } catch {
      setError("Network error — please check your connection and try again.");
    }
    setBusy(false);
  };
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button type="button"
        disabled={busy}
        onClick={onClick}
        className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold disabled:opacity-60"
      >
        <RefreshCw size={14} /> {busy ? "Checking…" : "Refresh Alerts"}
      </button>
      {error && <span className="text-[11px] text-coral">{error}</span>}
    </div>
  );
}
