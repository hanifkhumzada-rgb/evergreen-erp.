import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Mirrors lib/session.js's getCurrentProfile() for the Customer Portal.
// app/portal/(main)/layout.js AND every app/portal/(main)/*/page.js (via
// requirePortalCustomer() in app/portal/actions.js) independently resolved
// "who's logged in, what's their customer_id" — an auth.getUser() round
// trip plus a fn_current_customer_id() RPC call, twice per navigation.
// React's cache() memoizes this per request, same as the staff app.
export const getPortalCustomer = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, customerId: null };
  const { data: customerId } = await supabase.rpc("fn_current_customer_id");
  return { supabase, user, customerId: customerId || null };
});
