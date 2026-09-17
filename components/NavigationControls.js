"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, LayoutDashboard } from "lucide-react";

const HISTORY_KEY = "evergreen-erp-history";
const INDEX_KEY = "evergreen-erp-history-index";

export default function NavigationControls() {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({ stack: [], index: -1 });

  useEffect(() => {
    let stack = [];
    try { stack = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]"); } catch { stack = []; }
    let index = Number(sessionStorage.getItem(INDEX_KEY));
    if (!Number.isInteger(index) || index < 0 || index >= stack.length) index = stack.length - 1;
    if (stack[index] !== pathname) {
      stack = [...stack.slice(0, index + 1), pathname].slice(-30);
      index = stack.length - 1;
    }
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(stack));
    sessionStorage.setItem(INDEX_KEY, String(index));
    setState({ stack, index });
  }, [pathname]);

  const goBack = () => {
    if (state.index > 0) {
      const index = state.index - 1;
      sessionStorage.setItem(INDEX_KEY, String(index));
      setState((current) => ({ ...current, index }));
      router.push(state.stack[index]);
    } else router.push("/dashboard");
  };

  const goForward = () => {
    if (state.index >= state.stack.length - 1) return;
    const index = state.index + 1;
    sessionStorage.setItem(INDEX_KEY, String(index));
    setState((current) => ({ ...current, index }));
    router.push(state.stack[index]);
  };

  return (
    <nav className="erp-nav-controls flex items-center gap-1" aria-label="ERP page history">
      <button type="button" onClick={goBack} title="Previous ERP page"
        className="erp-nav-button">
        <ArrowLeft size={16} /><span className="hidden xl:inline">Back</span>
      </button>
      <button type="button" onClick={goForward} disabled={state.index >= state.stack.length - 1} title="Next ERP page"
        className="erp-nav-button disabled:cursor-not-allowed disabled:opacity-35">
        <ArrowRight size={16} /><span className="hidden xl:inline">Next</span>
      </button>
      <button type="button" onClick={() => router.push("/dashboard")} title="Dashboard"
        className="erp-nav-button hidden sm:inline-flex">
        <LayoutDashboard size={16} />
      </button>
    </nav>
  );
}
