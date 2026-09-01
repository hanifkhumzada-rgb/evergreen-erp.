import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
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
              // never persisting a login across sessions. A removal (empty
              // value) keeps its options — those carry the past expiry that
              // actually deletes the cookie, e.g. on sign-out.
              if (value) {
                const { maxAge, expires, ...rest } = options || {};
                cookieStore.set(name, value, rest);
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
