// Report menu shared by the Reports page (server) and ReportsBrowser
// (client). Kept in a plain module: a constant exported from a
// "use client" file is only a client reference on the server.
export const REPORT_GROUPS = [
  { label: "Sales", reports: ["Sales Report", "Customer Profitability", "Area / Route Report"] },
  { label: "Receivables", reports: ["Customer Ledger", "Receivables Report"] },
  { label: "Deliveries", reports: ["Delivery Report"] },
  { label: "Bottles", reports: ["Bottle Report"] },
  { label: "Inventory", reports: ["Inventory Report"] },
  { label: "Expenses", reports: ["Expense Report"] },
  { label: "Team", reports: ["Employee Performance"] },
];
