import { createClient } from "@/lib/supabase/server";
import { Th, Td, pkr } from "@/components/ui";
import AddZoneForm from "@/components/AddZoneForm";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  const supabase = await createClient();
  const [{ data: zones }, { data: customers }, { data: invoices }] = await Promise.all([
    supabase.from("zones").select("*").order("name"),
    supabase.from("customers").select("id, zone_id"),
    supabase.from("invoices").select("net_amount, customers(zone_id)").neq("status", "void"),
  ]);

  const custByZone = {};
  (customers || []).forEach((c) => { if (c.zone_id) custByZone[c.zone_id] = (custByZone[c.zone_id] || 0) + 1; });
  const revByZone = {};
  (invoices || []).forEach((i) => {
    const zid = i.customers?.zone_id;
    if (zid) revByZone[zid] = (revByZone[zid] || 0) + Number(i.net_amount);
  });

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Zones &amp; Routes</h2>
      <p className="text-slate text-sm mb-5">Delivery areas — customers and revenue are grouped by zone throughout the app.</p>

      <div className="no-print flex justify-end mb-4"><AddZoneForm /></div>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Zone</Th><Th>Description</Th><Th>Customers</Th><Th>Revenue</Th></tr></thead>
          <tbody>
            {(zones || []).length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate">No zones yet — add one to start organizing routes.</td></tr>}
            {(zones || []).map((z) => (
              <tr key={z.id} className="hover:bg-foam">
                <Td className="font-semibold">{z.name}</Td>
                <Td>{z.description || "—"}</Td>
                <Td>{custByZone[z.id] || 0}</Td>
                <Td>{pkr(revByZone[z.id] || 0)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
