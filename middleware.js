import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value; },
        set(name, value, options) {
          // Drop maxAge/expires so the session cookie is browser-session-only
          // (cleared when the browser fully closes) instead of persisting login.
          const { maxAge, expires, ...rest } = options || {};
          response.cookies.set({ name, value, ...rest });
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
