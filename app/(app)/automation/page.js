import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";
import AutomationRulesForm from "@/components/AutomationRulesForm";
import AutomationCenterForm from "@/components/AutomationCenterForm";
import CustomerTrackingToggle from "@/components/CustomerTrackingToggle";
import { Zap, Send, Activity, ShieldCheck } from "lucide-react";

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
  const [{ data: rules }, { data: canManage }, { data: businessSettings }] = await Promise.all([
    supabase.from("automation_rules").select("*").order("key"),
    supabase.rpc("fn_has_permission", { perm_key: "settings.manage" }),
    supabase.from("business_settings").select("customer_live_tracking_enabled").maybeSingle(),
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
  const enabledCount = (rules || []).filter((r) => r.enabled).length;
  const successCount = (rules || []).reduce((sum, r) => sum + Number(r.success_count || 0), 0);
  const failedCount = (rules || []).reduce((sum, r) => sum + Number(r.failed_count || 0), 0);

  return (
    <div>
      <div className="mb-5 rounded-3xl bg-gradient-to-r from-[#073F3A] to-[#087C69] p-6 text-white"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9DDD7]">Always-on operations</p><h2 className="font-display text-2xl font-semibold">Automation Workflow Center</h2><p className="mt-1 text-sm text-[#D7EFEC]">Trigger → customer segment → WhatsApp/SMS → delivery tracking, all controlled by the Owner.</p></div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[{label:"Active workflows",value:enabledCount,icon:Zap,tone:"text-aqua bg-aquaSoft"},{label:"Messages sent",value:successCount,icon:Send,tone:"text-green bg-greenSoft"},{label:"Needs attention",value:failedCount,icon:Activity,tone:"text-coral bg-coralSoft"},{label:"Approval control",value:"Owner",icon:ShieldCheck,tone:"text-navy bg-foam"}].map(({label,value,icon:Icon,tone}) => <div key={label} className="rounded-2xl border border-line bg-card p-4"><span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon size={17}/></span><p className="mt-3 text-xl font-bold">{value}</p><p className="text-xs text-slate">{label}</p></div>)}
      </div>
      {!twilioConfigured && (
        <div className="mb-5">
          <Badge text="WhatsApp/SMS sending needs Twilio configured (Settings → Integrations) — every automation below is safe to turn on now and will start sending the moment it's connected." tone="amber" />
        </div>
      )}
      <div className="flex flex-col gap-5">
        <AutomationCenterForm rules={commRules} twilioConfigured={twilioConfigured} />
        <AutomationRulesForm rules={alertRules} />
        <CustomerTrackingToggle initialEnabled={businessSettings?.customer_live_tracking_enabled !== false} />
      </div>
    </div>
  );
}
