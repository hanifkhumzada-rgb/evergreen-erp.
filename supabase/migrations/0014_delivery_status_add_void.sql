-- Every dashboard/employee-performance/zones query that sums delivered
-- quantity or counts completed deliveries already filters on
-- status = 'delivered' (an allowlist, same pattern as expense_status/
-- invoice_status) — adding 'void' here means voiding a delivery excludes
-- it from every one of those existing sums automatically. Its own
-- migration/transaction — a newly added enum value can't be referenced by
-- name in the same transaction that adds it.
alter type delivery_status add value if not exists 'void';
