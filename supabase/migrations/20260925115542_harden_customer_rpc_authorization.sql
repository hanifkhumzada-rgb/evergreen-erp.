-- Harden customer-facing SECURITY DEFINER RPCs against cross-customer access
-- and prevent authenticated portal users from advancing customer codes.

create or replace function public.fn_next_customer_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_has_permission('customers.create') then
    raise exception 'permission denied: customers.create required';
  end if;
  return 'EW-' || lpad(nextval('public.customer_code_seq')::text, 4, '0');
end;
$$;

create or replace function public.fn_customer_ageing(
  p_customer_id uuid,
  p_asof date default current_date
)
returns table(
  current_amt numeric,
  d1_30 numeric,
  d31_60 numeric,
  d61_90 numeric,
  d90_plus numeric,
  total_outstanding numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with authz as (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.business_id = public.fn_current_business_id()
      and (
        public.fn_current_customer_id() = p_customer_id
        or public.fn_has_permission('payments.view')
        or public.fn_has_permission('reports.view')
      )
  ), debits as (
    select cle.id, cle.entry_date, cle.debit as amt,
      sum(cle.debit) over (order by cle.entry_date, cle.created_at, cle.id) as cum_debit
    from public.customer_ledger_entries cle
    where cle.customer_id = p_customer_id
      and cle.debit > 0
      and exists (select 1 from authz)
  ), tot as (
    select coalesce(sum(cle.credit),0) as total_credit
    from public.customer_ledger_entries cle
    where cle.customer_id = p_customer_id
      and exists (select 1 from authz)
  ), outstanding as (
    select d.id, d.entry_date,
      greatest(0, least(d.amt, d.cum_debit - tot.total_credit)) as outstanding_amt
    from debits d cross join tot
  )
  select
    coalesce(sum(outstanding_amt) filter (where p_asof - entry_date <= 0), 0),
    coalesce(sum(outstanding_amt) filter (where p_asof - entry_date between 1 and 30), 0),
    coalesce(sum(outstanding_amt) filter (where p_asof - entry_date between 31 and 60), 0),
    coalesce(sum(outstanding_amt) filter (where p_asof - entry_date between 61 and 90), 0),
    coalesce(sum(outstanding_amt) filter (where p_asof - entry_date > 90), 0),
    coalesce(sum(outstanding_amt), 0)
  from outstanding;
$$;

create or replace function public.fn_resolve_product_rate(
  p_customer_id uuid,
  p_product_id uuid,
  p_asof date default current_date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case when exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.business_id = public.fn_current_business_id()
      and (
        public.fn_current_customer_id() = p_customer_id
        or (
          public.fn_has_permission('customers.view')
          and (
            public.fn_current_role_key() <> 'rider'
            or c.assigned_rider_id = auth.uid()
          )
        )
      )
  ) then coalesce(
    (select cp.price from public.customer_prices cp
     where cp.customer_id = p_customer_id
       and cp.product_id = p_product_id
       and cp.effective_from <= p_asof
       and (cp.effective_to is null or cp.effective_to >= p_asof)
     order by cp.effective_from desc limit 1),
    (select pp.price from public.product_prices pp
     where pp.product_id = p_product_id
       and pp.effective_from <= p_asof
       and (pp.effective_to is null or pp.effective_to >= p_asof)
     order by pp.effective_from desc limit 1)
  ) else null end;
$$;

revoke execute on function public.fn_next_customer_code() from public, anon;
revoke execute on function public.fn_customer_ageing(uuid, date) from public, anon;
revoke execute on function public.fn_resolve_product_rate(uuid, uuid, date) from public, anon;
grant execute on function public.fn_next_customer_code() to authenticated, service_role;
grant execute on function public.fn_customer_ageing(uuid, date) to authenticated, service_role;
grant execute on function public.fn_resolve_product_rate(uuid, uuid, date) to authenticated, service_role;
