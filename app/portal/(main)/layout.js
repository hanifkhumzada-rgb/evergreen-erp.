import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortalShell from "@/components/portal/PortalShell";

export default async function PortalMainLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: customerId } = await supabase.rpc("fn_current_customer_id");
  if (!customerId) redirect("/portal/login");

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
