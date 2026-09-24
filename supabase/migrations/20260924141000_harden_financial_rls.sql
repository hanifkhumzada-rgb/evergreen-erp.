-- Security hardening found by the pre-live role/RLS test matrix
-- (every probe ran as the real role through `set role authenticated` +
-- request.jwt.claims, inside a transaction that was always rolled back).
--
-- 1. customer_ledger_entries INSERT: anyone holding payments.create
--    (Delivery Boy, Manager, Accountant) could insert an ARBITRARY row —
--    e.g. a PKR 99,999 credit — straight into any customer's ledger,
--    bypassing payment approval, duplicate protection and the journal.
--    Every legitimate ledger posting path is a SECURITY DEFINER function
--    (payments/invoices/bottle/opening-balance triggers, smart entry,
--    record_delivery_completion, void workflows), which bypass RLS. The
--    one direct client insert the app makes is postDeliveryToLedger()
--    (app/actions.js): a single DEBIT for a delivery the caller can see.
--    The policy now allows exactly that shape and nothing else.
--
-- 2. customer_ledger_entries SELECT: a Delivery Boy (customers.view) could
--    read every customer's financial ledger although the customers table
--    itself limits riders to their assigned customers. Riders now see
--    ledger rows only for customers assigned to them or on their own
--    deliveries. Other roles are unchanged.
--
-- 3. smart_entries SELECT: any signed-in user of the business — including
--    a Customer Portal login — could read all staff Smart Entry records
--    (other customers' names, amounts, notes). Now requires
--    smart_entry.view; riders see only entries they created.
--
-- 4. invoices UPDATE: Manager/Accountant (invoices.create) could overwrite
--    a posted invoice's net_amount directly, desynchronising it from the
--    ledger. The app never updates invoices from the client — status and
--    void changes go through SECURITY DEFINER functions — so direct
--    UPDATE is restricted to invoices.delete holders (Owner).
--
-- 5. customers financial columns: credit_limit / opening_balance /
--    discount_pct were protected only in the server action. A trigger now
--    enforces customers.manage_financial (Owner/Admin) at the database for
--    any end-user session. Service-role and SECURITY DEFINER paths (no JWT
--    user / owner role) are unaffected.

-- 1 + 2 ---------------------------------------------------------------
create index if not exists idx_ledger_reference on public.customer_ledger_entries(reference_type, reference_id);

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
    and not exists (
      select 1 from public.customer_ledger_entries x
      where x.reference_type = 'delivery'
        and x.reference_id = customer_ledger_entries.reference_id
    )
  );

drop policy if exists p_ledger_select on public.customer_ledger_entries;
create policy p_ledger_select on public.customer_ledger_entries
  as permissive for select to public
  using (
    (select public.fn_has_permission('payments.view'::text))
    or (
      (select public.fn_has_permission('customers.view'::text))
      and (
        (select public.fn_current_role_key()) <> 'rider'::text
        or exists (select 1 from public.customers c
                   where c.id = customer_ledger_entries.customer_id
                     and c.assigned_rider_id = (select auth.uid()))
        or exists (select 1 from public.deliveries d
                   where d.customer_id = customer_ledger_entries.customer_id
                     and d.rider_id = (select auth.uid()))
      )
    )
  );

-- 3 -------------------------------------------------------------------
drop policy if exists p_smart_entries_select on public.smart_entries;
create policy p_smart_entries_select on public.smart_entries
  as permissive for select to public
  using (
    business_id = (select public.fn_current_business_id())
    and (select public.fn_has_permission('smart_entry.view'::text))
    and ((select public.fn_current_role_key()) <> 'rider'::text or created_by = (select auth.uid()))
  );

-- 4 -------------------------------------------------------------------
drop policy if exists p_invoices_update on public.invoices;
create policy p_invoices_update on public.invoices
  as permissive for update to public
  using ((select public.fn_has_permission('invoices.delete'::text)))
  with check ((select public.fn_has_permission('invoices.delete'::text)));

-- 5 -------------------------------------------------------------------
create or replace function public.fn_guard_customer_financial_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Only end-user sessions are checked. Service-role jobs and SECURITY
  -- DEFINER workflows run without an authenticated end user.
  if auth.uid() is null or current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if (new.credit_limit is distinct from old.credit_limit
      or new.opening_balance is distinct from old.opening_balance
      or new.discount_pct is distinct from old.discount_pct)
     and not public.fn_has_permission('customers.manage_financial') then
    raise exception 'Changing credit limit, opening balance or discount requires the customers.manage_financial permission'
      using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function public.fn_guard_customer_financial_columns() from public, anon;

drop trigger if exists trg_guard_customer_financial_columns on public.customers;
create trigger trg_guard_customer_financial_columns
  before update on public.customers
  for each row execute function public.fn_guard_customer_financial_columns();
