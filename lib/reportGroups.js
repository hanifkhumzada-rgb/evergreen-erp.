// Report menu shared by the Reports page (server) and ReportsBrowser
// (client). Kept in a plain module: a constant exported from a
// "use client" file is only a client reference on the server.
// Sales, Receivables/Outstanding, Delivery, Bottle, Inventory and Expense
// reports moved to the Interactive Report Viewer (/reports/<key>); these
// are the remaining analysis tables, kept so nothing was lost.
export const REPORT_GROUPS = [
  { label: "Sales analysis", reports: ["Customer Profitability", "Area / Route Report"] },
  { label: "Team", reports: ["Employee Performance"] },
];

// Old ?report= names → their new interactive report.
export const LEGACY_REPORT_ROUTES = {
  "Sales Report": "/reports/sales",
  "Receivables Report": "/reports/outstanding",
  "Customer Ledger": "/ledger",
  "Delivery Report": "/reports/deliveries",
  "Bottle Report": "/reports/bottles",
  "Inventory Report": "/reports/inventory",
  "Expense Report": "/reports/expenses",
};
