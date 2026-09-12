"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, LayoutDashboard } from "lucide-react";

const HISTORY_KEY = "evergreen-erp-history";

export default function NavigationControls() {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const previous = sessionStorage.getItem(HISTORY_KEY);
    setCanGoBack(Boolean(previous && previous !== pathname));
    if (previous !== pathname) sessionStorage.setItem(HISTORY_KEY, pathname);
  }, [pathname]);

  const goBack = () => {
    if (window.history.length > 1 && canGoBack) router.back();
    else router.push("/dashboard");
  };

  return (
    <nav className="flex items-center gap-1" aria-label="ERP page history">
      <button type="button" onClick={goBack} title="Previous ERP page"
        className="p-1.5 rounded-lg border border-line bg-card hover:bg-aquaSoft hover:text-aqua transition-colors">
        <ArrowLeft size={16} />
      </button>
      <button type="button" onClick={() => router.forward()} title="Next ERP page"
        className="p-1.5 rounded-lg border border-line bg-card hover:bg-aquaSoft hover:text-aqua transition-colors">
        <ArrowRight size={16} />
      </button>
      <button type="button" onClick={() => router.push("/dashboard")} title="Dashboard"
        className="hidden sm:inline-flex p-1.5 rounded-lg border border-line bg-card hover:bg-aquaSoft hover:text-aqua transition-colors">
        <LayoutDashboard size={16} />
      </button>
    </nav>
  );
}
