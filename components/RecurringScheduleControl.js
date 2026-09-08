"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, PlayCircle, XCircle as CancelIcon } from "lucide-react";
import { pauseRecurringSchedule, resumeRecurringSchedule, cancelRecurringSchedule } from "@/app/actions";
import { Badge } from "@/components/ui";
import Toast from "@/components/Toast";

const STATUS_BADGE = {
  active: { text: "Active", tone: "green" },
  paused: { text: "Paused", tone: "amber" },
  cancelled: { text: "Cancelled", tone: "coral" },
};
const DAY_LABEL = { Sun: "Sun", Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat" };

// Pause/resume/cancel a customer's recurring schedule — the daily cron
// (app/api/cron/recurring-orders) only ever creates automatic pending
// deliveries for recurring_status='active' customers, so this is the whole
// control surface for that automation. Never touches historical deliveries,
// invoices, or payments — purely a "stop/start generating new ones" switch.
export default function RecurringScheduleControl({ customer }) {
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const router = useRouter();
  const status = customer.recurring_status || "active";
  const badge = STATUS_BADGE[status] || STATUS_BADGE.active;

  const run = async (action, label) => {
    setBusy(label);
    try {
      const res = await action(customer.id);
      setBusy(null);
      if (res?.error) { setToast({ type: "error", message: res.error }); return; }
      setToast({ type: "success", message: `Recurring schedule ${label}.` });
      router.refresh();
    } catch {
      setBusy(null);
      setToast({ type: "error", message: "Network error — please check your connection and try again." });
    }
  };

  const hasSchedule = customer.regular_qty > 0 && customer.default_product_id;

  return (
    <div className="border border-line rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-sm font-bold">Recurring Schedule</h4>
        <Badge text={badge.text} tone={badge.tone} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-slate mb-3">
        <span>
          Days: {Array.isArray(customer.preferred_days) && customer.preferred_days.length > 0
            ? customer.preferred_days.map((d) => DAY_LABEL[d] || d).join(", ")
            : customer.delivery_frequency === "daily" ? "Every day" : "Not set"}
        </span>
        <span>Regular qty: <strong className="text-ink">{customer.regular_qty || "—"}</strong></span>
      </div>
      {!hasSchedule && (
        <p className="text-[11.5px] text-slate mb-3">Set a regular quantity and default bottle size (Edit customer) before the daily automation can generate orders for this customer.</p>
      )}
      <div className="no-print flex flex-wrap gap-2">
        {status !== "active" && (
          <button type="button" disabled={busy !== null} onClick={() => run(resumeRecurringSchedule, "resumed")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-green bg-card text-xs font-semibold disabled:opacity-60">
            <PlayCircle size={14} /> {busy === "resumed" ? "Resuming…" : "Resume"}
          </button>
        )}
        {status === "active" && (
          <button type="button" disabled={busy !== null} onClick={() => run(pauseRecurringSchedule, "paused")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-amber bg-card text-xs font-semibold disabled:opacity-60">
            <PauseCircle size={14} /> {busy === "paused" ? "Pausing…" : "Pause"}
          </button>
        )}
        {status !== "cancelled" && (
          <button type="button" disabled={busy !== null} onClick={() => run(cancelRecurringSchedule, "cancelled")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-coral bg-card text-xs font-semibold disabled:opacity-60">
            <CancelIcon size={14} /> {busy === "cancelled" ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate mt-2.5">
        {status === "active" && "The daily automation will keep generating this customer's orders on their scheduled days."}
        {status === "paused" && "Paused — no automatic orders will be generated until resumed. Manual deliveries still work as usual."}
        {status === "cancelled" && "Cancelled — no automatic orders will be generated. Resume to restart the recurring schedule."}
      </p>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
