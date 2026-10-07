"use client";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

// Same session history stack NavigationControls (the top-bar Back/Next)
// keeps, so a viewer's Back/Close returns to the previous ERP screen and
// never leaves the ERP — when there is no previous ERP page (the viewer
// was opened straight from a shared link) it goes to `fallbackHref`.
const HISTORY_KEY = "evergreen-erp-history";
const INDEX_KEY = "evergreen-erp-history-index";

export function useErpBack(fallbackHref = "/dashboard") {
  const router = useRouter();
  return useCallback(() => {
    try {
      const stack = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
      let index = Number(sessionStorage.getItem(INDEX_KEY));
      if (!Number.isInteger(index) || index >= stack.length) index = stack.length - 1;
      const current = window.location.pathname;
      // Walk back past entries that are this same viewer page.
      let target = index - 1;
      while (target >= 0 && stack[target] === current) target -= 1;
      if (target >= 0 && stack[target]) {
        sessionStorage.setItem(INDEX_KEY, String(target));
        router.push(stack[target]);
        return;
      }
    } catch {
      // sessionStorage unavailable — fall through to the fallback.
    }
    router.push(fallbackHref);
  }, [router, fallbackHref]);
}

// Print with a meaningful default PDF filename: browsers name a "Save as
// PDF" file after document.title, so it is swapped for the print run.
export function printWithTitle(fileTitle) {
  const previous = document.title;
  if (fileTitle) document.title = fileTitle.replace(/[\\/:*?"<>|]+/g, "-");
  const restore = () => { document.title = previous; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
  setTimeout(restore, 1500);
}

export async function shareOrCopy({ title, text, url }) {
  const shareUrl = url || window.location.href;
  if (navigator.share) {
    try { await navigator.share({ title, text, url: shareUrl }); } catch { /* dismissed */ }
    return "shared";
  }
  try {
    await navigator.clipboard.writeText([text, shareUrl].filter(Boolean).join("\n"));
    return "copied";
  } catch {
    window.prompt("Copy this link:", shareUrl);
    return "prompted";
  }
}

// wa.me link — Pakistani local numbers (03xx…) become 923xx…
export function whatsappHref(phone, text) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text || "")}`;
}

// Marks the body while a viewer is mounted (print rules key off it) and
// publishes the ERP top bar's real height so sticky toolbars sit under it.
export function useEwChrome(mode) {
  useEffect(() => {
    const cls = mode === "report" ? "ew-report-mode" : "ew-doc-mode";
    document.body.classList.add(cls);
    const bar = document.querySelector(".workspace-topbar");
    const setTop = () => document.body.style.setProperty("--ew-top", `${bar ? bar.offsetHeight : 0}px`);
    setTop();
    window.addEventListener("resize", setTop);
    return () => {
      document.body.classList.remove(cls);
      document.body.style.removeProperty("--ew-top");
      window.removeEventListener("resize", setTop);
    };
  }, [mode]);
}
