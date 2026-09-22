import { cache } from "react";
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
  if (!session.user) throw new Error("Not authenticated");
  if (!session.customerId) throw new Error("Not a customer session");
  return session;
}
