import Link from "@/components/ErpNavLink";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Callout } from "@/components/ui";
import BusinessSettingsForm from "@/components/BusinessSettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: businessSettings }, { data: canManage }] = await Promise.all([
    supabase.from("business_settings").select("*").maybeSingle(),
    supabase.rpc("fn_has_permission", { perm_key: "settings.manage" }),
  ]);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Settings</h2>
      <p className="text-slate text-sm mb-4">Business branding, integrations, and automation — all in one place.</p>
      {canManage && <nav aria-label="Settings workspaces" className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {[
          ["/user-management", "Users", "Staff roles and active accounts"],
          ["/user-management/permissions", "Permissions", "Per-user actions and role defaults"],
          ["/automation", "Notification rules", "Triggers, channels and thresholds"],
          ["/communication", "Message delivery log", "Delivery results, failed sends and retry"],
        ].map(([href, label, hint]) => <Link key={href} href={href} className="rounded-2xl border border-line bg-card p-4 hover:bg-foam"><h3 className="text-sm font-bold text-aqua">{label}</h3><p className="mt-1 text-xs text-slate">{hint}</p></Link>)}
      </nav>}
      <div className="flex flex-col gap-5">
        {canManage
          ? <BusinessSettingsForm settings={businessSettings} />
          : <p className="text-xs text-slate border border-line rounded-2xl p-5 max-w-3xl">Business branding is managed by the Owner.</p>}
        <Link href="/automation" className="flex items-center justify-between border border-line rounded-2xl p-5 max-w-3xl hover:bg-foam transition-colors">
          <div>
            <h4 className="text-sm font-bold mb-1">Automation Center</h4>
            <p className="text-xs text-slate">Payment reminders, delivery/receipt messages, monthly statements, alerts and every alert-threshold rule — all moved here.</p>
          </div>
          <ArrowRight size={18} className="text-aqua flex-shrink-0" />
        </Link>
        <Link href="/settings/integrations" className="flex items-center justify-between border border-line rounded-2xl p-5 max-w-3xl hover:bg-foam transition-colors">
          <div>
            <h4 className="text-sm font-bold mb-1">Integrations</h4>
            <p className="text-xs text-slate">Twilio WhatsApp/SMS connection status and setup.</p>
          </div>
          <ArrowRight size={18} className="text-aqua flex-shrink-0" />
        </Link>
        <div className="border border-line rounded-2xl p-5 max-w-xl">
          <h4 className="text-sm font-bold mb-2">About this build</h4>
          <p className="text-[13px] text-slate leading-relaxed">
            Real, multi-user, database-driven ERP: Next.js + Supabase Postgres, Supabase Auth, and Row Level Security
            enforcing roles at the database level. Sales, Payments and Expenses are recorded directly against
            customers and cash accounts, with a heuristic Profit &amp; Loss calculated live from invoices and expenses.
          </p>
          <div className="mt-3.5 flex flex-col gap-1.5">
            <Callout>Bottle deposit liability — tracked, but not yet auto-posted as a journal entry</Callout>
            <Callout>Granular per-action permissions and user overrides — manage under Users → Permissions</Callout>
            <Callout>Route performance &amp; driver on-time % — Coming Soon</Callout>
            <Callout>Automated notification triggers (low stock, overdue, bottle limit, inactive, payment overdue, low activity) — configurable in the Automation Center</Callout>
            <Callout>WhatsApp/SMS via Twilio — built, needs live credentials in Settings → Integrations to actually send</Callout>
            <Callout>AI sales forecasting &amp; anomaly detection — Coming Soon</Callout>
            <Callout>Server-rendered branded PDFs — invoices, statements, vouchers and daily reports; every other report has a matching branded print preview</Callout>
          </div>
        </div>
      </div>
    </div>
  );
}
