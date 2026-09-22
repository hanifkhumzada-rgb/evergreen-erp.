-- Security audit fix (2026-09-22). Three SECURITY DEFINER functions had no
-- internal authorization check at all, relying only on GRANT/REVOKE — and
-- were in fact grantable to (or left grantable to) anon/authenticated with
-- no ownership or business_id scoping:
--
-- 1. fn_customer_ageing(customer_id, asof) — callable by ANYONE, including
--    fully anonymous requests (no session at all), with any customer_id,
--    returning that customer's full receivables aging breakdown. Called
--    legitimately from app/(app)/ledger/page.js via supabase.rpc, so it
--    stays callable — just scoped to the caller's own business now.
-- 2. fn_resolve_product_rate(customer_id, product_id, asof) — same gap,
--    leaking a business's negotiated pricing. Not called directly from any
--    client code (grep confirmed) — only from fn_post_smart_entry — so
--    beyond scoping it, direct anon/authenticated EXECUTE is revoked too.
-- 3. fn_post_smart_entry(id, actor) — the function that actually posts a
--    smart entry (inserting the real customer/delivery/payment/expense/
--    invoice rows). It took an arbitrary p_actor with no check that the
--    caller owns p_id's business or even that entry.status is still
--    'pending_approval' — a direct RPC call could post any business's
--    pending entry and misattribute it to any UUID. Not called directly
--    from any client code (grep confirmed; only reached via
--    fn_smart_entry_approve's internal `perform`, which runs as the
--    function owner and does not need EXECUTE granted to the calling
--    role) — so direct EXECUTE is revoked from anon/authenticated
--    entirely, closing this off rather than trying to patch it in place.

create or replace function public.fn_customer_ageing(p_customer_id uuid, p_asof date default current_date)
returns table(current_amt numeric, d1_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric, total_outstanding numeric)
language sql stable security definer set search_path to 'public'
as $function$
  with authz as (
    select 1 from customers where id = p_customer_id and business_id = fn_current_business_id()
  ), debits as (
    select id, entry_date, debit as amt,
      sum(debit) over (order by entry_date, created_at, id) as cum_debit
    from customer_ledger_entries
    where customer_id = p_customer_id and debit > 0 and exists (select 1 from authz)
  ), tot as (
    select coalesce(sum(credit),0) as total_credit from customer_ledger_entries
    where customer_id = p_customer_id and exists (select 1 from authz)
  ), outstanding as (
    select d.id, d.entry_date, greatest(0, least(d.amt, d.cum_debit - tot.total_credit)) as outstanding_amt
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
$function$;

create or replace function public.fn_resolve_product_rate(p_customer_id uuid, p_product_id uuid, p_asof date default current_date)
returns numeric
language sql stable security definer set search_path to 'public'
as $function$
  select case when exists (
    select 1 from customers where id = p_customer_id and business_id = fn_current_business_id()
  ) then coalesce(
    (select price from customer_prices where customer_id = p_customer_id and product_id = p_product_id
       and effective_from <= p_asof and (effective_to is null or effective_to >= p_asof)
       order by effective_from desc limit 1),
    (select price from product_prices where product_id = p_product_id
       and effective_from <= p_asof and (effective_to is null or effective_to >= p_asof)
       order by effective_from desc limit 1)
  ) else null end;
$function$;

-- fn_post_smart_entry itself is unchanged (its logic is fine when reached
-- only through fn_smart_entry_approve's own permission/ownership check) —
-- just close the direct RPC path.
revoke execute on function public.fn_post_smart_entry(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_resolve_product_rate(uuid, uuid, date) from public, anon;

-- Defense in depth: none of the Smart Entry write/approval functions are
-- meant for unauthenticated callers (they all fail closed on auth.uid()
-- being null already, via fn_current_business_id()/fn_has_permission —
-- verified in their bodies — but there is no reason to leave anon able to
-- attempt the call at all).
revoke execute on function public.fn_smart_entry_check(text, jsonb) from anon;
revoke execute on function public.fn_smart_entry_create(text, jsonb, text, text) from anon;
revoke execute on function public.fn_smart_entry_approve(uuid) from anon;
revoke execute on function public.fn_smart_entry_reject(uuid, text) from anon;
revoke execute on function public.fn_smart_entry_reverse(uuid, text) from anon;
revoke execute on function public.fn_smart_entry_submit(uuid) from anon;
revoke execute on function public.fn_smart_entry_update(uuid, jsonb) from anon;
revoke execute on function public.fn_smart_entry_delete(uuid, text) from anon;
revoke execute on function public.fn_validate_smart_entry(text, jsonb) from anon;
revoke execute on function public.fn_customer_ageing(uuid, date) from anon;

-- Unrelated minor finding from the same audit pass: this one function
-- (added with the Smart Entry migration) was missing the `set search_path`
-- every sibling SECURITY DEFINER/lookup function in this schema already
-- has — it never touches a table so it isn't currently exploitable, but
-- matching the established convention costs nothing.
create or replace function public.fn_smart_entry_required_permission(p_entry_type text)
returns text
language sql immutable set search_path to 'public'
as $function$
  select case p_entry_type
    when 'customer' then 'customers.create'
    when 'delivery' then 'deliveries.create'
    when 'payment' then 'payments.create'
    when 'expense' then 'expenses.create'
    when 'bottle' then 'bottles.manage'
    when 'inventory_purchase' then 'purchases.manage'
    when 'employee_salary' then 'employees.manage'
    when 'invoice_adjustment' then 'invoices.create'
    when 'complaint_feedback' then 'customers.edit'
  end;
$function$;
