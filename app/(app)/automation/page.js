import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";
import AutomationRulesForm from "@/components/AutomationRulesForm";
import AutomationCenterForm from "@/components/AutomationCenterForm";

export const dynamic = "force-dynamic";

// The single control surface for every automation in the app — moved
// here from Settings so Payment Reminders/Delivery Messages/Payment
// Receipts/Monthly Statements/Customer Follow-up/Owner Alerts/Daily
// Summary (communication automations, new) sit next to the existing
// alert-threshold rules (low stock, overdue, bottle balance, low
// activity, ...) instead of being scattered. Both sections read/write
// the same automation_rules table (extended, not replaced — see
// migration 0030) via the same updateAutomationRule() action; this page
// only decides how to group and label the rows.
export default async function AutomationCenterPage() {
  const supabase = await createClient();
  const [{ data: rules }, { data: canManage }] = await Promise.all([
    supabase.from("automation_rules").select("*").order("key"),
    supabase.rpc("fn_has_permission", { perm_key: "settings.manage" }),
  ]);

  if (!canManage) {
    return (
      <div>
        <h2 className="font-display text-2xl font-semibold mb-4">Automation Center</h2>
        <p className="text-xs text-slate border border-line rounded-2xl p-5 max-w-3xl">Automation settings are managed by the Owner.</p>
      </div>
    );
  }

  const commRules = (rules || []).filter((r) => r.category === "communication");
  const alertRules = (rules || []).filter((r) => r.category !== "communication");
  // No env vars read here on purpose — Twilio isn't wired up yet
  // (Phase 3). This flag exists now so the UI already knows how to show
  // "configured" the moment TWILIO_ACCOUNT_SID/AUTH_TOKEN land, without
  // another page edit.
  const twilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Automation Center</h2>
      <p className="text-slate text-sm mb-5">
        Every automated message and alert in one place — turn things on/off, pick a channel, and see what actually ran.
      </p>
      {!twilioConfigured && (
        <div className="mb-5">
          <Badge text="WhatsApp/SMS sending needs Twilio configured (Settings → Integrations) — every automation below is safe to turn on now and will start sending the moment it's connected." tone="amber" />
        </div>
      )}
      <div className="flex flex-col gap-5">
        <AutomationCenterForm rules={commRules} twilioConfigured={twilioConfigured} />
        <AutomationRulesForm rules={alertRules} />
      </div>
    </div>
  );
}
