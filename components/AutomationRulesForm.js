"use client";
import { useState } from "react";
import { updateAutomationRule } from "@/app/actions";
import Toast from "@/components/Toast";

const UNIT = {
  outstanding_balance: "PKR",
  customer_inactive: "days",
  stock_reorder: "",
  bottle_limit: "bottles (default for new customers)",
  payment_overdue: "days",
  high_bottle_balance: "% with customers",
  bottle_shortage: "days",
  unreconciled_bottles: "days",
  damaged_bottle_increase: "bottles / 7 days",
  lost_bottle_increase: "bottles / 7 days",
};

function RuleRow({ rule }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const showThreshold = rule.key !== "stock_reorder";

  const handleSubmit = async (formData) => {
    setBusy(true);
    const res = await updateAutomationRule(rule.id, formData);
    setBusy(false);
    if (res?.error) { setToast({ type: "error", message: res.error }); return; }
    setToast({ type: "success", message: `${rule.label} updated.` });
  };

  return (
    <form action={handleSubmit} className="flex flex-wrap items-center gap-3 py-3 border-b border-line last:border-b-0">
      <input type="checkbox" name="enabled" defaultChecked={rule.enabled} className="w-4 h-4 accent-aqua flex-shrink-0" />
      <div className="flex-1 min-w-[180px]">
        <div className="text-sm font-semibold">{rule.label}</div>
        <div className="text-xs text-slate">{rule.description}</div>
      </div>
      {showThreshold ? (
        <label className="flex items-center gap-1.5 flex-shrink-0">
          <input
            type="number" name="threshold_value" defaultValue={rule.threshold_value}
            className="w-24 px-2 py-1.5 rounded-lg border border-line bg-card text-ink text-sm"
          />
          <span className="text-xs text-slate whitespace-nowrap">{UNIT[rule.key]}</span>
        </label>
      ) : (
        <input type="hidden" name="threshold_value" value={rule.threshold_value} />
      )}
      <button disabled={busy} type="submit" className="px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold disabled:opacity-60 flex-shrink-0">
        {busy ? "Saving…" : "Save"}
      </button>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </form>
  );
}

export default function AutomationRulesForm({ rules }) {
  return (
    <div className="border border-line rounded-2xl p-5 max-w-2xl">
      <h4 className="text-sm font-bold mb-1">Automation Rules</h4>
      <p className="text-xs text-slate mb-1">
        Toggle and configure the thresholds that drive automatic alerts on the Dashboard and Notifications page.
        Tap &quot;Refresh Alerts&quot; on Notifications after changing these to regenerate flags immediately.
      </p>
      <div>
        {rules.map((r) => <RuleRow key={r.id} rule={r} />)}
      </div>
    </div>
  );
}
