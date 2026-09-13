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
  const isPasswordReset = pathname.startsWith("/reset-password");
  const isPortalRoute = pathname.startsWith("/portal");
  const isPortalLogin = pathname === "/portal/login";
  const isAppRoute = !isAuthRoute && !isPasswordReset && !isPortalRoute && pathname !== "/";

  if (!user && isAppRoute) return NextResponse.redirect(new URL("/login", request.url));
  if (!user && isPortalRoute && !isPortalLogin) return NextResponse.redirect(new URL("/portal/login", request.url));
  if (user && isAuthRoute) return NextResponse.redirect(new URL("/dashboard", request.url));

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|ew-mark.svg|manifest.json|sw.js).*)"],
};
