-- Target the highest-frequency ERP reads found in pg_stat_statements.
-- Tenant id leads every index because RLS scopes normal application reads
-- to one business before applying date/status filters.

create index if not exists idx_invoices_business_date_active
  on public.invoices (business_id, invoice_date desc)
  where status <> 'void';

create index if not exists idx_invoices_business_due_open
  on public.invoices (business_id, due_date)
  where status not in ('paid', 'void');

create index if not exists idx_deliveries_business_date_status
  on public.deliveries (business_id, delivery_date desc, status);

create index if not exists idx_deliveries_business_created
  on public.deliveries (business_id, created_at desc);

create index if not exists idx_expenses_business_date_status
  on public.expenses (business_id, expense_date desc, status);

create index if not exists idx_expenses_business_created
  on public.expenses (business_id, created_at desc);

create index if not exists idx_payments_business_date_active
  on public.payments (business_id, payment_date desc)
  where voided = false;

create index if not exists idx_payments_business_created_active
  on public.payments (business_id, created_at desc)
  where voided = false;

create index if not exists idx_customers_business_active_created
  on public.customers (business_id, is_active, created_at);
