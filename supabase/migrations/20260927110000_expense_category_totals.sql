-- Per-category spend for the Expenses page cards (all-time + this month),
-- aggregated in the database instead of loading every expense row.
-- SECURITY INVOKER: RLS on expenses applies to the caller.
create or replace function public.fn_expense_category_totals(p_today date default current_date)
returns table (category_id uuid, all_total numeric, all_count bigint, month_total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.category_id,
         coalesce(sum(e.amount), 0),
         count(*),
         coalesce(sum(e.amount) filter (where e.expense_date >= date_trunc('month', p_today)::date), 0)
  from public.expenses e
  where e.status in ('approved', 'paid')
  group by e.category_id;
$$;
revoke all on function public.fn_expense_category_totals(date) from public, anon;
grant execute on function public.fn_expense_category_totals(date) to authenticated;
