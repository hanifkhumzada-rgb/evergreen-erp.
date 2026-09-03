import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { REMEMBER_ME_COOKIE, REMEMBER_ME_MAX_AGE } from "@/lib/rememberMe";

export async function middleware(request) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  const remembered = request.cookies.get(REMEMBER_ME_COOKIE)?.value === "1";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value; },
        set(name, value, options) {
          // Drop maxAge/expires so the session cookie is browser-session-only
          // (cleared when the browser fully closes) instead of persisting
          // login — UNLESS the login page set the "remember me" cookie, in
          // which case a capped, reasonable maxAge is kept instead (see
          // lib/rememberMe.js). This runs on every request, so a token
          // refreshed here keeps the same lifetime the sign-in call chose.
          if (remembered) {
            const { expires, maxAge, ...rest } = options || {};
            response.cookies.set({ name, value, ...rest, maxAge: Math.min(maxAge || REMEMBER_ME_MAX_AGE, REMEMBER_ME_MAX_AGE) });
          } else {
            const { maxAge, expires, ...rest } = options || {};
            response.cookies.set({ name, value, ...rest });
          }
        },
        remove(name, options) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login");
  // The password-recovery email link lands here with a token that only the
  // browser (not this server-side check) can see and exchange for a
  // session — so this route has to be reachable while still unauthenticated,
  // same as /login, or the client-side code that processes the link would
  // never get to run.
  const isPasswordReset = pathname.startsWith("/reset-password");
  const isAppRoute = !isAuthRoute && !isPasswordReset && pathname !== "/";

  if (!user && isAppRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = {
  // favicon.ico was the only public/ file excluded here — every other file
  // in public/ (icon-192.png, icon-512.png, manifest.json, sw.js) fell
  // through to the "no session -> redirect to /login" branch above, so an
  // <img>/<link> tag requesting one from an unauthenticated page (the login
  // page itself, or the PWA manifest before first login) got back the
  // /login HTML page instead of the actual asset. Listed explicitly rather
  // than by a generic extension pattern — a regex like `.*\.[\w]+$` inside
  // this negative lookahead also matches _next/static's own hashed .js/.css
  // chunk requests in a way path-to-regexp doesn't resolve the same as a
  // plain JS RegExp would, which broke the app entirely (confirmed live).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|manifest.json|sw.js).*)"],
};
