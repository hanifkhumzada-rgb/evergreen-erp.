import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Every navigation re-runs layout.js's Server Component AND the matched
// page.js's — and both independently needed "who's logged in, what's their
// role", so on pages like Customers/Deliveries/Expenses that meant two
// separate auth.getUser() round trips (a real network call to Supabase
// Auth, not a local check) plus two separate profile/role queries, back to
// back, before either page could even start its own data fetch.
//
// React's cache() memoizes this per request: whichever of layout.js or the
// page calls it first pays the round trip, everyone else in that same
// render reuses the resolved result for free. Safe by construction — it's
// the same client, same user, same profile row either way, just fetched
// once instead of twice.
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("*, roles(key, name)").eq("id", user.id).single();
  return { supabase, user, profile };
});
