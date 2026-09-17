// Single source of truth for invoice status label/color — previously
// duplicated with disagreeing tones across sales, invoices, customer
// timeline and sale-detail pages (e.g. a voided invoice read gray on one
// page and red on another).
export const INVOICE_STATUS_LABEL = {
  paid: "Paid", partially_paid: "Partially Paid", sent: "Pending",
  draft: "Draft", overdue: "Overdue", void: "Void",
};

export const INVOICE_STATUS_TONE = {
  paid: "green", partially_paid: "amber", sent: "amber",
  draft: "slate", overdue: "coral", void: "coral",
};
