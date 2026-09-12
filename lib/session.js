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
  if (!user) return { supabase, user: null, profile: null, businessId: null, roleKey: null };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*, roles(key, name)").eq("id", user.id).single();
  if (profileError) console.error("[session] profile lookup failed", { userId: user.id, code: profileError.code });

  // PostgREST normally returns the many-to-one roles relation as an object,
  // but relationship metadata/cache changes can temporarily return an array
  // or no embedded relation at all.  The old layout passed that missing value
  // to Sidebar, which silently filtered every workspace from the mobile menu.
  const embeddedRole = Array.isArray(profile?.roles) ? profile.roles[0] : profile?.roles;
  let roleKey = embeddedRole?.key?.toString().trim().toLowerCase() || null;
  if (!roleKey && profile) {
    const { data: rpcRole, error: roleError } = await supabase.rpc("fn_current_role_key");
    if (roleError) console.error("[session] role fallback failed", { userId: user.id, code: roleError.code });
    roleKey = rpcRole?.toString().trim().toLowerCase() || null;
  }
  // Every tenant-scoped table is already filtered to this by RLS
  // (restrictive p_business_isolation policies, migration 0025) regardless
  // of what a query asks for — this is here for callers that need the id
  // itself (an explicit filter, a join condition, stamping it on a payload
  // headed through the admin client), not as the thing making isolation
  // work.
  return { supabase, user, profile, businessId: profile?.business_id ?? null, roleKey };
});
