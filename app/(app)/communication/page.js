import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, KPI, Th, Td } from "@/components/ui";
import RetryNotificationButton from "@/components/RetryNotificationButton";
import DocumentPrintHeader from "@/components/DocumentPrintHeader";
import { getBrandingLite } from "@/lib/pdf/business";
import { isTwilioConfigured } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const STATUS_TONE = { pending: "slate", sent: "aqua", delivered: "green", failed: "coral" };
const RELATED_LABEL = { delivery: "Delivery", payment: "Payment" };

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Sent/Failed/Pending/Delivered counts, search, filter, retry, and each
// log's rendered message + customer + related transaction — the brief's
// "Communication Center". Reads notification_logs (migration 0031)
// directly; nothing here sends anything, it's a log viewer + retry.
export default async function CommunicationCenterPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  const [branding, { data: canView }, { data: logs }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.rpc("fn_has_permission", { perm_key: "settings.manage" }),
    supabase.from("notification_logs").select("*, customers(name, code)").order("created_at", { ascending: false }).limit(300),
  ]);

  if (!canView) {
    return (
      <div>
        <h2 className="font-display text-2xl font-semibold mb-4">Communication Center</h2>
        <p className="text-xs text-slate border border-line rounded-2xl p-5 max-w-3xl">Communication logs are managed by the Owner.</p>
      </div>
    );
  }

  const allRows = logs || [];
  const counts = { pending: 0, sent: 0, delivered: 0, failed: 0 };
  allRows.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status]++; });

  const q = (sp.q || "").trim().toLowerCase();
  const statusFilter = sp.status || "";
  const channelFilter = sp.channel || "";
  const rows = allRows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (channelFilter && r.channel !== channelFilter) return false;
    if (q && !`${r.customers?.name || ""} ${r.to_number} ${r.template_key}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const hasFilters = q || statusFilter || channelFilter;
  const configured = isTwilioConfigured();

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Communication Center" meta={`${rows.length} of ${allRows.length} messages`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Communication Center</h2>
      <p className="no-print text-slate text-sm mb-4">Every WhatsApp/SMS send attempt — real Twilio status only, never a faked "sent".</p>
      {!configured && (
        <div className="no-print mb-4">
          <Badge text="Twilio isn't configured yet — every send attempt below will show Failed until Settings → Integrations has real credentials." tone="amber" />
        </div>
      )}

      <div className="no-print flex flex-wrap gap-3.5 mb-5">
        <KPI label="SENT" value={counts.sent} tone="aqua" />
        <KPI label="DELIVERED" value={counts.delivered} tone="green" />
        <KPI label="PENDING" value={counts.pending} tone="slate" />
        <KPI label="FAILED" value={counts.failed} tone="coral" />
      </div>

      <form className="no-print flex flex-wrap gap-2.5 mb-4 items-center" action="/communication">
        <input type="text" name="q" defaultValue={sp.q || ""} placeholder="Search customer, phone, template…" className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-56" />
        <select name="status" defaultValue={statusFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
        </select>
        <select name="channel" defaultValue={channelFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All channels</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
        </select>
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Search</button>
        {hasFilters && <Link href="/communication" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-foam">
              <Th>When</Th><Th>Customer</Th><Th>Channel</Th><Th>Template</Th><Th>Message</Th><Th>Related</Th><Th>Status</Th><Th className="no-print">&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate">No messages match.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-foam align-top">
                <Td className="whitespace-nowrap">{fmtDateTime(r.created_at)}</Td>
                <Td>
                  {r.customers ? <Link href={`/customers/${r.customer_id}`} className="font-semibold text-navy hover:text-aqua">{r.customers.name}</Link> : "—"}
                  <div className="text-[10.5px] text-slate">{r.to_number}</div>
                </Td>
                <Td className="capitalize">{r.channel}</Td>
                <Td className="text-slate">{r.template_key}</Td>
                <Td className="max-w-[260px] whitespace-normal text-[12px] text-slate">{r.message_body}</Td>
                <Td>{r.related_type ? <span className="text-[11px] text-slate">{RELATED_LABEL[r.related_type] || r.related_type}</span> : "—"}</Td>
                <Td>
                  <Badge text={r.status} tone={STATUS_TONE[r.status] || "slate"} />
                  {r.error_message && <div className="text-[10px] text-coral mt-1 max-w-[160px]">{r.error_message}</div>}
                </Td>
                <Td className="no-print">
                  {r.status === "failed" && <RetryNotificationButton logId={r.id} />}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
