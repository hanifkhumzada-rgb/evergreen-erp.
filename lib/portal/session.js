import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Layouts and pages render in the same request. React cache keeps the
// authentication + customer lookup to one round trip per navigation.
export const getPortalSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, customerId: null };
  const { data: customerId } = await supabase.rpc("fn_current_customer_id");
  return { supabase, user, customerId };
});

export async function requirePortalCustomer() {
  const session = await getPortalSession();
  // Pages render alongside the layout, so they must redirect too rather
  // than throw (a throw here surfaced as a server error in the logs).
  if (!session.user) redirect("/portal/login");
  if (!session.customerId) redirect("/portal/no-access");
  return session;
}
