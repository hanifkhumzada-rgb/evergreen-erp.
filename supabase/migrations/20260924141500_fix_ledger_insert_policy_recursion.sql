-- Follow-up to 20260924141000_harden_financial_rls: the duplicate-debit
-- check in p_ledger_insert queried customer_ledger_entries from inside its
-- own policy, which Postgres rejects as policy recursion (42P17) — caught
-- by the rolled-back role test matrix before any user hit it. The check
-- now goes through a SECURITY DEFINER helper that returns only a boolean.
--
-- Verified after this change (rolled-back matrix):
--   Rider: debit for own delivery ALLOWED; other delivery / credit /
--          second debit for same delivery DENIED
--   Manager/Owner: debit for any delivery ALLOWED; credit / duplicate DENIED
--   Accountant/Customer: all direct ledger inserts DENIED
create or replace function public.fn_ledger_delivery_debit_exists(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.customer_ledger_entries
    where reference_type = 'delivery' and reference_id = p_delivery_id
  );
$$;
revoke all on function public.fn_ledger_delivery_debit_exists(uuid) from public, anon;
grant execute on function public.fn_ledger_delivery_debit_exists(uuid) to authenticated;

drop policy if exists p_ledger_insert on public.customer_ledger_entries;
create policy p_ledger_insert on public.customer_ledger_entries
  as permissive for insert to public
  with check (
    ((select public.fn_has_permission('payments.create'::text)) or (select public.fn_has_permission('deliveries.create'::text)))
    and reference_type = 'delivery'
    and coalesce(credit, 0) = 0
    and debit > 0
    and exists (
      select 1 from public.deliveries d
      where d.id = customer_ledger_entries.reference_id
        and d.customer_id = customer_ledger_entries.customer_id
    )
    and not public.fn_ledger_delivery_debit_exists(customer_ledger_entries.reference_id)
  );
