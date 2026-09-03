// Single source of truth for the "Remember me" cookie contract, shared by
// the login page (sets/clears it) and the three places that write the real
// Supabase session cookies — lib/supabase/client.js, lib/supabase/server.js,
// middleware.js — all of which strip the session cookie's maxAge/expires
// down to "browser-session-only" UNLESS this cookie says otherwise.
//
// Supabase's own default cookie maxAge (@supabase/ssr's DEFAULT_COOKIE_OPTIONS)
// is 400 days — the browser-enforced maximum, not a meaningful session
// length — so "remembered" logins cap to a deliberately shorter, reasonable
// window instead of inheriting that.
export const REMEMBER_ME_COOKIE = "sb-remember-me";
export const REMEMBER_ME_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, in seconds
