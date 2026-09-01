import { createBrowserClient } from "@supabase/ssr";

// @supabase/ssr's built-in browser cookie writer always forces a long-lived
// maxAge on the auth cookie regardless of any cookieOptions passed in, so a
// custom cookies.getAll/setAll is the only way to make the login session
// cookie browser-session-only (cleared when the browser fully closes) rather
// than persisting across restarts. Removal (maxAge: 0, used on sign-out)
// is left untouched so it still deletes the cookie immediately.
function getAll() {
  if (typeof document === "undefined") return [];
  return document.cookie
    .split("; ")
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      return { name: decodeURIComponent(pair.slice(0, idx)), value: decodeURIComponent(pair.slice(idx + 1)) };
    });
}

function setAll(cookiesToSet) {
  if (typeof document === "undefined") return;
  cookiesToSet.forEach(({ name, value, options }) => {
    const opts = { ...(options || {}) };
    if (opts.maxAge !== 0) {
      delete opts.maxAge;
      delete opts.expires;
    }
    let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    if (opts.path) cookieStr += `; path=${opts.path}`;
    if (opts.domain) cookieStr += `; domain=${opts.domain}`;
    if (typeof opts.maxAge === "number") cookieStr += `; max-age=${opts.maxAge}`;
    if (opts.sameSite) cookieStr += `; samesite=${opts.sameSite}`;
    if (opts.secure) cookieStr += "; secure";
    document.cookie = cookieStr;
  });
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll, setAll } }
  );
}
