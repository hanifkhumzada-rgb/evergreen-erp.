"use client";
import { useState } from "react";
import { updateAutomationRule } from "@/app/actions";
import { Badge } from "@/components/ui";
import Toast from "@/components/Toast";

function CommRow({ rule }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const handleSubmit = async (formData) => {
    setBusy(true);
    try {
      const res = await updateAutomationRule(rule.id, formData);
      setBusy(false);
      if (res?.error) { setToast({ type: "error", message: res.error }); return; }
      setToast({ type: "success", message: `${rule.label} updated.` });
    } catch {
      setBusy(false);
      setToast({ type: "error", message: "Network error — please check your connection and try again." });
    }
  };

  return (
    <form action={handleSubmit} className="border-b border-line last:border-b-0 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
      <input type="hidden" name="category" value="communication" />
      <input type="hidden" name="threshold_value" value={rule.threshold_value} />
      <label className="flex items-center gap-2.5 w-full sm:w-56 flex-shrink-0">
        <input type="checkbox" name="enabled" defaultChecked={rule.enabled} className="w-4 h-4 accent-aqua flex-shrink-0" />
        <div>
          <div className="text-sm font-semibold">{rule.label}</div>
          <div className="text-[11px] text-slate">{rule.schedule_note || "—"}</div>
        </div>
      </label>

      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="channel_whatsapp" defaultChecked={rule.channel_whatsapp} className="w-3.5 h-3.5 accent-green" /> WhatsApp
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="channel_sms" defaultChecked={rule.channel_sms} className="w-3.5 h-3.5 accent-aqua" /> SMS
        </label>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-slate flex-1 min-w-[180px]">
        <span>Last run: {rule.last_run_at ? new Date(rule.last_run_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "never"}</span>
        <span className="text-green">✓ {rule.success_count || 0}</span>
        <span className="text-coral">✕ {rule.failed_count || 0}</span>
      </div>

      <button disabled={busy} type="submit" className="px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold disabled:opacity-60 flex-shrink-0">
        {busy ? "Saving…" : "Save"}
      </button>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </form>
  );
}

// The Automation Center's primary table — every communication automation
// (Payment Reminders, Delivery Messages, Payment Receipts, Monthly
// Statements, Customer Follow-up, Owner Alerts, Daily Summary) as a row:
// ON/OFF, WhatsApp/SMS channel toggles, schedule, Last Run, Success/Failed
// counts. This is a config surface only — actually sending anything over
// WhatsApp/SMS needs the Twilio integration (Settings → Integrations) to
// be configured; until then every row here just controls what WOULD send
// once it is.
export default function AutomationCenterForm({ rules, twilioConfigured }) {
  return (
    <div className="border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-bold">Communication Automations</h4>
        <Badge text={twilioConfigured ? "Twilio connected" : "Provider credentials required to activate sending"} tone={twilioConfigured ? "green" : "amber"} />
      </div>
      <p className="text-xs text-slate mb-1">
        Turn each automation on/off and pick its channel(s). Free wa.me one-tap buttons keep working everywhere regardless of these
        settings — this only controls automatic sending.
      </p>
      <div>
        {rules.map((r) => <CommRow key={r.id} rule={r} />)}
      </div>
    </div>
  );
}
