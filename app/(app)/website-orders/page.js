import { createClient } from "@/lib/supabase/server";
import { KPI, Badge, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

function fmtDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function phoneHref(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `tel:${digits}` : null;
}

function whatsappHref(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export default async function WebsiteOrdersPage() {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "orders.view" });

  if (!allowed) {
    return <p className="max-w-3xl rounded-2xl border border-line p-5 text-xs text-slate">Website requests are visible to staff with order viewing permission.</p>;
  }

  const { data: requests, error } = await supabase
    .from("website_order_requests")
    .select("id, customer_name, phone, delivery_address, bottle_quantity, note, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[website-orders] request lookup failed", { code: error.code });
  }

  const rows = requests || [];
  const pending = rows.filter((row) => row.status === "pending").length;

  return (
    <div>
      <h2 className="mb-1 font-display text-2xl font-semibold">Website Orders</h2>
      <p className="mb-5 text-sm text-slate">Public website requests waiting for staff follow-up. These remain requests until your team confirms them.</p>

      <div className="mb-5 flex flex-wrap gap-3">
        <KPI label="PENDING REQUESTS" value={pending} tone="amber" />
        <KPI label="LATEST REQUESTS" value={rows.length} tone="aqua" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr><Th>Customer</Th><Th>Order</Th><Th>Delivery Address</Th><Th>Notes</Th><Th>Received</Th><Th>Status</Th><Th>Contact</Th></tr></thead>
          <tbody>
            {error && <tr><Td colSpan={7} className="py-8 text-center text-coral">Could not load website requests. Please refresh or contact your administrator.</Td></tr>}
            {!error && rows.length === 0 && <tr><Td colSpan={7} className="py-8 text-center text-slate">No website requests yet.</Td></tr>}
            {rows.map((row) => {
              const call = phoneHref(row.phone);
              const whatsapp = whatsappHref(row.phone);
              return (
                <tr key={row.id} className="align-top">
                  <Td><div className="font-semibold">{row.customer_name}</div><div className="text-xs text-slate">{row.phone}</div></Td>
                  <Td><span className="font-semibold">{row.bottle_quantity} × 19L bottle</span></Td>
                  <Td className="max-w-xs whitespace-normal">{row.delivery_address}</Td>
                  <Td className="max-w-xs whitespace-normal text-slate">{row.note || "—"}</Td>
                  <Td>{fmtDateTime(row.created_at)}</Td>
                  <Td><Badge text={row.status} tone={row.status === "pending" ? "amber" : "aqua"} /></Td>
                  <Td><div className="flex flex-col items-start gap-1.5">{call && <a href={call} className="text-xs font-semibold text-navy hover:text-aqua">Call</a>}{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="text-xs font-semibold text-navy hover:text-aqua">WhatsApp</a>}</div></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate">Showing the latest 100 requests. A request does not create a customer, delivery, payment, or stock movement.</p>
    </div>
  );
}
