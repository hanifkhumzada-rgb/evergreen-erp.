import { Badge } from "@/components/ui";

export default function SettingsPage() {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Settings</h2>
      <div className="border border-line rounded-2xl p-5 max-w-xl">
        <h4 className="text-sm font-bold mb-2">About this build</h4>
        <p className="text-[13px] text-slate leading-relaxed">
          Real, multi-user, database-driven ERP: Next.js + Supabase Postgres, Supabase Auth, and Row Level Security
          enforcing roles at the database level. A full double-entry accounting engine now runs underneath Sales,
          Payments and Expenses — every transaction posts a balanced journal entry automatically, and Trial Balance,
          Profit &amp; Loss and Balance Sheet are all calculated live from those journals, never hardcoded.
        </p>
        <div className="mt-3.5 flex flex-col gap-1.5">
          <Badge text="Bottle deposit liability — tracked, but not yet auto-posted as a journal entry" tone="slate" />
          <Badge text="Granular per-action permissions (view/create/edit/approve/export) — Coming Soon, role-level only for now" tone="slate" />
          <Badge text="Route performance & driver on-time % — Coming Soon" tone="slate" />
          <Badge text="Automated notification triggers (low stock, overdue) — table ready, triggers not yet wired" tone="slate" />
          <Badge text="WhatsApp Business API (official) — Coming Soon" tone="slate" />
          <Badge text="AI sales forecasting & anomaly detection — Coming Soon" tone="slate" />
          <Badge text="Server-rendered PDF (currently uses browser print) — Coming Soon" tone="slate" />
        </div>
      </div>
    </div>
  );
}
