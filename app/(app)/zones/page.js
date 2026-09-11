import { createClient } from "@/lib/supabase/server";
import { pkr } from "@/lib/format";
import { Th, Td, Badge, KPI } from "@/components/ui";
import AddZoneForm from "@/components/AddZoneForm";
import AddRouteForm from "@/components/AddRouteForm";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import { deleteZone, deleteRoute } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: zones }, { data: customers }, { data: invoices }, { data: routes }, { data: riders }, { data: deliveries }, { data: canDeleteZone }, { data: canDeleteRoute }] = await Promise.all([
    supabase.from("zones").select("*").order("name"),
    supabase.from("customers").select("id, zone_id, route_id"),
    supabase.from("invoices").select("net_amount, customers(zone_id)").neq("status", "void"),
    supabase.from("routes").select("*, zones(name), profiles(full_name)").order("name"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").eq("roles.key", "rider").eq("is_active", true).order("full_name"),
    supabase.from("deliveries").select("customer_id, status, amount_collected, rider_id, customers(route_id)").eq("delivery_date", today),
    supabase.rpc("fn_has_permission", { perm_key: "zones.delete" }),
    supabase.rpc("fn_has_permission", { perm_key: "routes.delete" }),
  ]);

  const custByZone = {};
  (customers || []).forEach((c) => { if (c.zone_id) custByZone[c.zone_id] = (custByZone[c.zone_id] || 0) + 1; });
  const revByZone = {};
  (invoices || []).forEach((i) => {
    const zid = i.customers?.zone_id;
    if (zid) revByZone[zid] = (revByZone[zid] || 0) + Number(i.net_amount);
  });
  const custByRoute = {};
  (customers || []).forEach((c) => { if (c.route_id) custByRoute[c.route_id] = (custByRoute[c.route_id] || 0) + 1; });
  const deliveriesByRoute = {};
  (deliveries || []).forEach((d) => {
    const rid = d.customers?.route_id;
    if (rid) deliveriesByRoute[rid] = (deliveriesByRoute[rid] || 0) + 1;
  });
  const completedToday = (deliveries || []).filter((d) => d.status === "delivered").length;
  const missedToday = (deliveries || []).filter((d) => ["missed", "failed", "cancelled"].includes(d.status)).length;
  const pendingToday = (deliveries || []).filter((d) => !["delivered", "missed", "failed", "cancelled", "void"].includes(d.status)).length;
  const collectedToday = (deliveries || []).reduce((sum, d) => sum + Number(d.amount_collected || 0), 0);
  const unassignedRoutes = (routes || []).filter((r) => r.is_active && !r.assigned_rider_id).length;

  return (
    <div>
      <div className="mb-5 rounded-3xl border border-aqua/20 bg-gradient-to-r from-[#073F3A] to-[#087C69] p-5 text-white sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A9DDD7]">Live operations</p>
        <h2 className="font-display text-2xl font-semibold">Route Control Center</h2>
        <p className="mt-1 text-sm text-[#D7EFEC]">Plan zones, assign riders and monitor today’s route execution.</p>
      </div>
      <div className="mb-6 flex flex-wrap gap-3.5">
        <KPI label="TODAY'S STOPS" value={(deliveries || []).length} tone="navy" />
        <KPI label="COMPLETED" value={completedToday} tone="green" />
        <KPI label="PENDING" value={pendingToday} tone="amber" />
        <KPI label="MISSED" value={missedToday} tone={missedToday ? "coral" : "slate"} />
        <KPI label="COLLECTED" value={pkr(collectedToday)} tone="aqua" />
        <KPI label="UNASSIGNED ROUTES" value={unassignedRoutes} tone={unassignedRoutes ? "coral" : "slate"} />
      </div>

      <div className="no-print flex justify-end mb-4"><AddZoneForm /></div>

      <div className="overflow-x-auto border border-line rounded-2xl mb-8">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Zone</Th><Th>Description</Th><Th>Customers</Th><Th>Revenue</Th><Th className="no-print">&nbsp;</Th></tr></thead>
          <tbody>
            {(zones || []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate">No zones yet — add one to start organizing routes.</td></tr>}
            {(zones || []).map((z) => (
              <tr key={z.id} className="hover:bg-foam">
                <Td className="font-semibold">{z.name}</Td>
                <Td>{z.description || "—"}</Td>
                <Td>{custByZone[z.id] || 0}</Td>
                <Td>{pkr(revByZone[z.id] || 0)}</Td>
                <Td className="no-print">
                  {canDeleteZone && (
                    <ReasonConfirmButton action={deleteZone} id={z.id} label="Delete" icon="trash"
                      confirmText={`Permanently delete zone "${z.name}"?`}
                      detailText="This can't be undone. Blocked automatically if the zone still has customers, routes, or other records assigned to it."
                      confirmLabel="Confirm Delete" busyLabel="Deleting…" />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mb-2.5">
        <div><h3 className="font-display text-base font-semibold">Today’s route board</h3><p className="text-xs text-slate">Delivery counts below are for {today}</p></div>
        <div className="no-print"><AddRouteForm zones={zones || []} riders={riders || []} /></div>
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Route</Th><Th>Zone</Th><Th>Delivery Boy</Th><Th>Customers</Th><Th>Deliveries</Th><Th>Status</Th><Th className="no-print">&nbsp;</Th></tr></thead>
          <tbody>
            {(routes || []).length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate">No routes yet — add one, then assign customers to it from Customer Master.</td></tr>}
            {(routes || []).map((r) => (
              <tr key={r.id} className="hover:bg-foam">
                <Td className="font-semibold">{r.name}</Td>
                <Td>{r.zones?.name || "—"}</Td>
                <Td>{r.profiles?.full_name || "—"}</Td>
                <Td>{custByRoute[r.id] || 0}</Td>
                <Td>{deliveriesByRoute[r.id] || 0}</Td>
                <Td><Badge text={r.is_active ? "Active" : "Inactive"} tone={r.is_active ? "green" : "slate"} /></Td>
                <Td className="no-print">
                  {canDeleteRoute && (
                    <ReasonConfirmButton action={deleteRoute} id={r.id} label="Delete" icon="trash"
                      confirmText={`Permanently delete route "${r.name}"?`}
                      detailText="This can't be undone. Blocked automatically if the route still has customers assigned to it."
                      confirmLabel="Confirm Delete" busyLabel="Deleting…" />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
