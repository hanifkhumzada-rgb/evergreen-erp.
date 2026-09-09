import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortalShell from "@/components/portal/PortalShell";

export default async function PortalMainLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: customerId } = await supabase.rpc("fn_current_customer_id");
  // Authenticated but not a customer-portal account (a staff login that
  // ended up here) — send them to their actual home instead of back to
  // the portal's login form. This used to be middleware's job via its
  // own extra `profiles` query on every navigation; doing it here
  // instead reuses the fn_current_customer_id() call this layout already
  // makes for its own needs, at zero extra cost.
  if (!customerId) redirect("/dashboard");

  const [{ data: customer }, { count: unread }] = await Promise.all([
    supabase.from("customers").select("id, name, code").eq("id", customerId).maybeSingle(),
    supabase.from("customer_notifications").select("id", { count: "exact", head: true }).eq("customer_id", customerId).eq("is_read", false),
  ]);

  return (
    <PortalShell customerName={customer?.name} customerCode={customer?.code} unreadCount={unread || 0}>
      {children}
    </PortalShell>
  );
}
