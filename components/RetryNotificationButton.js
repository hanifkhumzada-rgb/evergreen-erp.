"use client";
import { useState } from "react";
import { RotateCw } from "lucide-react";
import { retryNotificationLog } from "@/app/actions";
import Toast from "@/components/Toast";

export default function RetryNotificationButton({ logId }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const handleClick = async () => {
    setBusy(true);
    try {
      const res = await retryNotificationLog(logId);
      setBusy(false);
      setToast(res.ok ? { type: "success", message: "Resent." } : { type: "error", message: res.error || "Retry failed." });
    } catch {
      setBusy(false);
      setToast({ type: "error", message: "Network error — please check your connection and try again." });
    }
  };

  return (
    <>
      <button type="button" disabled={busy} onClick={handleClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold hover:bg-foam disabled:opacity-60">
        <RotateCw size={12} className={busy ? "animate-spin" : ""} /> {busy ? "Retrying…" : "Retry"}
      </button>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
