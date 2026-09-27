-- KPI aggregates for server-paginated list pages. Previously these pages
-- loaded every row (e.g. every invoice ever) just to add up four KPI
-- numbers. These run as the calling user (SECURITY INVOKER), so RLS
-- applies exactly as it does to the list itself.

create or replace function public.fn_invoice_kpis(p_today date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total_count',   count(*),
    'today_count',   count(*) filter (where invoice_date = p_today),
    'today_amount',  coalesce(sum(net_amount) filter (where invoice_date = p_today and status <> 'void'), 0),
    'month_count',   count(*) filter (where invoice_date >= date_trunc('month', p_today)::date),
    'month_amount',  coalesce(sum(net_amount) filter (where invoice_date >= date_trunc('month', p_today)::date and status <> 'void'), 0),
    'unpaid_count',  count(*) filter (where status in ('sent', 'partially_paid', 'overdue')),
    'unpaid_amount', coalesce(sum(net_amount) filter (where status in ('sent', 'partially_paid', 'overdue')), 0),
    'billed_amount', coalesce(sum(net_amount) filter (where status <> 'void'), 0)
  )
  from public.invoices;
$$;
revoke all on function public.fn_invoice_kpis(date) from public, anon;
grant execute on function public.fn_invoice_kpis(date) to authenticated;

create or replace function public.fn_expense_kpis(p_today date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total_count',     count(*),
    'today_amount',    coalesce(sum(amount) filter (where expense_date = p_today and status in ('approved', 'paid')), 0),
    'month_amount',    coalesce(sum(amount) filter (where expense_date >= date_trunc('month', p_today)::date and status in ('approved', 'paid')), 0),
    'pending_count',   count(*) filter (where status = 'submitted'),
    'pending_amount',  coalesce(sum(amount) filter (where status = 'submitted'), 0)
  )
  from public.expenses;
$$;
revoke all on function public.fn_expense_kpis(date) from public, anon;
grant execute on function public.fn_expense_kpis(date) to authenticated;
