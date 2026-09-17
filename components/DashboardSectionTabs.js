"use client";

import { useState } from "react";
import { LayoutDashboard, CalendarCheck2, WalletCards, Sparkles } from "lucide-react";

const SECTIONS = [
  { id: "dashboard-overview", label: "Overview", icon: LayoutDashboard },
  { id: "dashboard-today", label: "Today", icon: CalendarCheck2 },
  { id: "dashboard-finance", label: "Finance", icon: WalletCards },
  { id: "dashboard-insights", label: "Insights", icon: Sparkles },
];

export default function DashboardSectionTabs() {
  const [active, setActive] = useState(SECTIONS[0].id);

  const jumpTo = (id) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="dashboard-section-tabs no-print nav-scroll" aria-label="Dashboard sections">
      {SECTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => jumpTo(id)}
          aria-current={active === id ? "page" : undefined}
          className={active === id ? "dashboard-section-tab is-active" : "dashboard-section-tab"}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
