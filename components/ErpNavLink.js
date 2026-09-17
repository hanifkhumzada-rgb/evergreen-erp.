"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";

// Full dynamic-route preload only on intent, rather than launching every
// sidebar page's database queries together. No shared/persistent data cache.
export default function ErpNavLink({ href, onMouseEnter, onFocus, onTouchStart, ...props }) {
  const router = useRouter();
  const pathname = usePathname();
  const lastWarm = useRef(0);
  function warm() {
    const connection = navigator.connection;
    if (pathname === href || !navigator.onLine || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
    if (Date.now() - lastWarm.current < 15000) return;
    lastWarm.current = Date.now();
    router.prefetch(href);
  }
  return <Link {...props} href={href} prefetch={false}
    onMouseEnter={(event) => { warm(); onMouseEnter?.(event); }}
    onFocus={(event) => { warm(); onFocus?.(event); }}
    onTouchStart={(event) => { warm(); onTouchStart?.(event); }} />;
}
