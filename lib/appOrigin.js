import { headers } from "next/headers";

// Public origin of this deployment for links sent to customers. Prefers
// NEXT_PUBLIC_APP_URL; otherwise the request's own host (Vercel sets
// x-forwarded-host/proto), so links always point at the live app.
export function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
