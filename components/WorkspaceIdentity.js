"use client";

import { usePathname } from "next/navigation";

const ROUTES = [
  ["/smart-entry", "Smart Entry", "Daily transaction workspace"],
  ["/dashboard", "Owner Control Room", "Business overview"],
  ["/customers", "Customers", "Customer master & accounts"],
  ["/deliveries", "Deliveries", "Routes, bottles & collections"],
  ["/payments", "Payments", "Receipts & recovery"],
  ["/expenses", "Expenses", "Cost control"],
  ["/invoices", "Invoices & Billing", "Sales documents"],
  ["/ledger", "Customer Ledger", "Balances & statements"],
  ["/bottle-ledger", "Bottle Inventory", "Bottle movement control"],
  ["/inventory", "Purchases & Stock", "Inventory control"],
  ["/operations", "Daily Operations", "Today’s command centre"],
  ["/tracking", "Live Tracking", "Team location"],
  ["/reports", "Reports", "Performance intelligence"],
  ["/accounting", "Accounting", "Books & financial statements"],
  ["/employees", "Employees", "Team management"],
  ["/fleet", "Fleet", "Vehicles & maintenance"],
  ["/notifications", "Notifications", "Actionable alerts"],
  ["/settings", "Settings", "ERP configuration"],
];

export default function WorkspaceIdentity() {
  const pathname = usePathname();
  const match = ROUTES.find(([prefix]) => pathname.startsWith(prefix));
  const title = match?.[1] || "Evergreen ERP";
  const context = match?.[2] || "Secure management workspace";

  return (
    <div className="workspace-context hidden min-[430px]:block">
      <div className="workspace-context-label">{context}</div>
      <div className="workspace-context-title">{title}</div>
    </div>
  );
}
