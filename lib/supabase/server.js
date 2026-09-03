import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE } from "@/lib/rememberMe";

export async function createClient() {
  const cookieStore = await cookies();
  const remembered = cookieStore.get(REMEMBER_ME_COOKIE)?.value === "1";
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Drop maxAge/expires on real session cookies so they become
              // browser-session-only (cleared when the browser fully closes),
              // never persisting a login across sessions — UNLESS the login
              // page set the "remember me" cookie, in which case a capped,
              // reasonable maxAge is kept instead (see lib/rememberMe.js).
              // A removal (empty value) always keeps its options as-is —
              // those carry the past expiry that actually deletes the
              // cookie, e.g. on sign-out — regardless of remember-me.
              if (value) {
                if (remembered) {
                  const { expires, maxAge, ...rest } = options || {};
                  cookieStore.set(name, value, { ...rest, maxAge: Math.min(maxAge || REMEMBER_ME_MAX_AGE, REMEMBER_ME_MAX_AGE) });
                } else {
                  const { maxAge, expires, ...rest } = options || {};
                  cookieStore.set(name, value, rest);
                }
              } else {
                cookieStore.set(name, value, options);
              }
            });
          } catch {}
        },
      },
    }
  );
}

export function createAdminClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
