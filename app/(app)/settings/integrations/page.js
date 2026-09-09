import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { twilioConfigStatus, isTwilioConfigured } from "@/lib/twilio";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const ENV_VAR_LABEL = {
  TWILIO_ACCOUNT_SID: "Account SID",
  TWILIO_AUTH_TOKEN: "Auth Token",
  TWILIO_PHONE_NUMBER: "Twilio Phone Number (SMS)",
  TWILIO_WHATSAPP_NUMBER: "Twilio WhatsApp Number",
};

// Deliberately NOT a form — Twilio credentials are read from environment
// variables only (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_
// PHONE_NUMBER / TWILIO_WHATSAPP_NUMBER), never written to or read from
// the database or sent to the browser. This page shows whether each var
// is set (a boolean, computed server-side) and nothing else — the actual
// values never leave the server process. Set them wherever this app's
// other env vars already live (e.g. the Vercel project's Environment
// Variables) and redeploy; there's nothing to click here to "save" them.
export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: canManage } = await supabase.rpc("fn_has_permission", { perm_key: "settings.manage" });

  if (!canManage) {
    return (
      <div>
        <h2 className="font-display text-2xl font-semibold mb-4">Integrations</h2>
        <p className="text-xs text-slate border border-line rounded-2xl p-5 max-w-3xl">Integrations are managed by the Owner.</p>
      </div>
    );
  }

  const status = twilioConfigStatus();
  const configured = isTwilioConfigured();

  return (
    <div>
      <Link href="/settings" className="flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Settings</Link>
      <h2 className="font-display text-2xl font-semibold mb-1">Integrations</h2>
      <p className="text-slate text-sm mb-5">WhatsApp and SMS sending run through Twilio. Free wa.me one-tap buttons keep working everywhere regardless of this.</p>

      <div className="border border-line rounded-2xl p-5 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-bold">WhatsApp / SMS — Twilio</h4>
          <Badge text={configured ? "Connected" : "Provider credentials required to activate sending"} tone={configured ? "green" : "amber"} />
        </div>
        <p className="text-xs text-slate mb-4">
          Set these as environment variables on the server (never entered here, never stored in the database) and redeploy.
          Every automation in the Automation Center is safe to turn on now — sending starts the moment these are set.
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {Object.entries(ENV_VAR_LABEL).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-line">
              <div>
                <div className="text-[13px] font-semibold">{label}</div>
                <code className="text-[10.5px] text-slate">{key}</code>
              </div>
              {status[key]
                ? <span className="flex items-center gap-1 text-xs font-semibold text-green"><CheckCircle2 size={14} /> Set</span>
                : <span className="flex items-center gap-1 text-xs font-semibold text-coral"><XCircle size={14} /> Not set</span>}
            </div>
          ))}
        </div>
        <div className="text-[11px] text-slate border-t border-line pt-3">
          <p className="mb-1">Twilio status-callback webhook (set as the StatusCallback on the Twilio number, or set NEXT_PUBLIC_APP_URL and it's passed automatically):</p>
          <code className="block bg-foam rounded-lg px-2.5 py-1.5">/api/webhooks/twilio-status</code>
        </div>
      </div>
    </div>
  );
}
