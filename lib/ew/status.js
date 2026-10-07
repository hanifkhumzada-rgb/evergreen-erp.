// Evergreen Water status system — ONE mapping from every record status in
// the ERP to a label and a colour family, used by documents, report
// viewers, the detail drawer and Excel exports alike.
//
// Plain module (no "use client") so Server and Client Components can both
// import it — see the pkr()/fmtDate() incident in lib/format.js history.
//
//   green  → Paid, Delivered, Approved, Clear
//   orange → Pending, Partial, Payment Due, Low Stock
//   red    → Overdue, Missed, Failed, Critical
//   blue   → Draft, Normal, Information

const MAP = {
  // invoices
  paid: ["Paid", "green"],
  partially_paid: ["Partial", "orange"],
  partial: ["Partial", "orange"],
  sent: ["Payment Due", "orange"],
  draft: ["Draft", "blue"],
  overdue: ["Overdue", "red"],
  void: ["Void", "red"],
  voided: ["Void", "red"],
  // deliveries
  delivered: ["Delivered", "green"],
  partially_delivered: ["Partial", "orange"],
  pending: ["Pending", "orange"],
  assigned: ["Scheduled", "blue"],
  scheduled: ["Scheduled", "blue"],
  out_for_delivery: ["Out for Delivery", "blue"],
  customer_not_available: ["Not Available", "red"],
  missed: ["Missed", "red"],
  cancelled: ["Cancelled", "red"],
  rescheduled: ["Rescheduled", "orange"],
  // expenses
  submitted: ["Pending", "orange"],
  approved: ["Approved", "green"],
  rejected: ["Rejected", "red"],
  // purchases
  ordered: ["Ordered", "blue"],
  received: ["Received", "green"],
  // receivables / ageing
  current: ["Current", "green"],
  clear: ["Clear", "green"],
  payment_due: ["Payment Due", "orange"],
  critical: ["Critical", "red"],
  // stock / bottles
  ok: ["Normal", "blue"],
  normal: ["Normal", "blue"],
  low_stock: ["Low Stock", "orange"],
  out_of_stock: ["Out of Stock", "red"],
  mismatch: ["Mismatch", "red"],
  over_limit: ["Over Limit", "orange"],
  // closing / adjustments
  closed: ["Closed", "green"],
  open: ["Open", "orange"],
  posted: ["Posted", "green"],
  failed: ["Failed", "red"],
  received_payment: ["Received", "green"],
  info: ["Information", "blue"],
};

export function statusInfo(status) {
  const key = String(status || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (MAP[key]) return { label: MAP[key][0], tone: MAP[key][1] };
  if (!key) return { label: "—", tone: "blue" };
  return { label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), tone: "blue" };
}

export const TONE_CLASS = {
  green: "ew-badge ew-badge-green",
  orange: "ew-badge ew-badge-orange",
  red: "ew-badge ew-badge-red",
  blue: "ew-badge ew-badge-blue",
};

// Receivable ageing bucket from days since the oldest unpaid activity /
// last payment. Same thresholds everywhere (Outstanding report, drawer).
export function ageingStatus(balance, daysSinceLastPayment) {
  if (!(Number(balance) > 0)) return "clear";
  const d = Number(daysSinceLastPayment);
  if (!Number.isFinite(d) || d > 90) return "critical";
  if (d > 60) return "overdue";
  if (d > 30) return "payment_due";
  return "current";
}

export function ageingLabel(days) {
  const d = Number(days);
  if (!Number.isFinite(d)) return "No payment yet";
  if (d <= 30) return "0–30 days";
  if (d <= 60) return "31–60 days";
  if (d <= 90) return "61–90 days";
  return "90+ days";
}

export const PAYMENT_METHOD_LABEL = {
  cash: "Cash", bank: "Bank", easypaisa: "Easypaisa", jazzcash: "JazzCash",
  online_transfer: "Online Transfer", other: "Other",
};

export function methodLabel(m) {
  return PAYMENT_METHOD_LABEL[m] || (m ? String(m).replace(/_/g, " ") : "—");
}
