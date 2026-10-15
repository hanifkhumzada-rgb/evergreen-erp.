import { getCurrentProfile } from "@/lib/session";
import TrackingWorkspace from "@/components/TrackingWorkspace";

export const dynamic = "force-dynamic";
const RECENT_HOURS = 24;

export default async function TrackingPage() {
  const { supabase, user, profile, roleKey, permissions = [] } = await getCurrentProfile();
  const isRider = roleKey === "rider";
  const canMonitor = ["owner", "admin", "manager"].includes(roleKey) && permissions.includes("gps.view");
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - RECENT_HOURS * 3600000).toISOString();

  let deliveryQuery = supabase.from("deliveries")
    .select("id,delivery_no,rider_id,status,delivery_date,customers(id,code,name,mobile,address,area,route_id,routes(name),zones(name)),delivery_items(delivered_qty,expected_qty)")
    .eq("delivery_date", today).neq("status", "void").order("created_at");
  if (isRider) deliveryQuery = deliveryQuery.eq("rider_id", user.id);

  const [{ data: deliveries }, { data: riders }, { data: locationRows }, { data: routes }] = await Promise.all([
    deliveryQuery,
    canMonitor ? supabase.from("profiles").select("id,full_name,employee_code,phone,zone_id,zones(name),roles!inner(key,name)").eq("roles.key", "rider").eq("is_active", true).order("full_name") : Promise.resolve({ data: [] }),
    canMonitor ? supabase.from("staff_locations").select("user_id,latitude,longitude,recorded_at").gte("recorded_at", cutoff).order("recorded_at", { ascending: false }) : Promise.resolve({ data: [] }),
    canMonitor ? supabase.from("routes").select("id,name,assigned_rider_id,zones(name)").eq("is_active", true).order("name") : supabase.from("routes").select("id,name,assigned_rider_id,zones(name)").eq("assigned_rider_id", user.id).eq("is_active", true),
  ]);

  const latestByUser = {};
  (locationRows || []).forEach((row) => { if (!latestByUser[row.user_id]) latestByUser[row.user_id] = row; });
  const routeByRider = {};
  (routes || []).forEach((route) => { if (route.assigned_rider_id) routeByRider[route.assigned_rider_id] = route; });
  const deliveryByRider = {};
  (deliveries || []).forEach((delivery) => { (deliveryByRider[delivery.rider_id] ||= []).push(delivery); });
  const riderRows = (riders || []).map((rider) => ({
    id: rider.id, name: rider.full_name, code: rider.employee_code, mobile: rider.phone,
    role: rider.roles?.name || "Delivery Boy", zone: rider.zones?.name || routeByRider[rider.id]?.zones?.name || "—",
    route: routeByRider[rider.id]?.name || "Unassigned", location: latestByUser[rider.id] || null,
    deliveries: deliveryByRider[rider.id] || [],
  }));

  return <TrackingWorkspace roleKey={roleKey} canMonitor={canMonitor}
    currentUser={{ id: user.id, name: profile?.full_name || "Delivery Boy" }} riders={riderRows}
    deliveries={deliveries || []} routes={routes || []} historyCount={(locationRows || []).length} />;
}
