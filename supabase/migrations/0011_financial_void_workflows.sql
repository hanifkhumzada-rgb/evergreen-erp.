-- Section 6-7 of the feature request: financial records (expenses,
-- payments, invoices) must never be hard-deleted — only voided, with a
-- mandatory reason, and the accounting effects (journal entries, customer
-- ledger, cash) correctly reversed so the books stay balanced. Hard DELETE
-- was already impossible for these three tables (no RLS DELETE policy
-- exists at all, verified below), so this migration only adds the void
-- machinery.

alter table expenses add column if not exists voided boolean not null default false;
alter table expenses add column if not exists void_reason text;
alter table expenses add column if not exists voided_at timestamptz;
alter table expenses add column if not exists voided_by uuid references profiles(id);

alter table payments add column if not exists voided boolean not null default false;
alter table payments add column if not exists void_reason text;
alter table payments add column if not exists voided_at timestamptz;
alter table payments add column if not exists voided_by uuid references profiles(id);

-- invoices.status already has a 'void' value in its enum; just add the
-- reason/who/when detail columns to match the other two.
alter table invoices add column if not exists void_reason text;
alter table invoices add column if not exists voided_at timestamptz;
alter table invoices add column if not exists voided_by uuid references profiles(id);

-- New DELETE-tier permissions, distinct from the existing create/edit/view
-- ones, so an Owner can grant "may void" separately from "may edit" (module
-- + action granularity is the whole point of the permission system this
-- schema already has). Seeded to owner/admin/accountant by default —
-- exactly the roles that already hold the create/edit permissions on these
-- three financial modules — and adjustable per-user from here on via the
-- Permissions screen.
insert into permissions (key, module, description) values
  ('expenses.delete', 'expenses', 'Void expenses'),
  ('payments.delete', 'payments', 'Void payments'),
  ('invoices.delete', 'invoices', 'Cancel/void invoices')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key in ('owner', 'admin', 'accountant') and p.key in ('expenses.delete', 'payments.delete', 'invoices.delete')
on conflict do nothing;

-- Column-aware guards, mirroring trg_guard_profile_privilege: expenses.edit
-- (the existing broad UPDATE policy) may keep touching every other column,
-- but only expenses.delete holders may flip the void columns — so "can
-- edit" and "can void" stay genuinely separate permissions, not just
-- separate UI buttons that both call the same unguarded UPDATE.
create or replace function public.fn_guard_expense_void_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (new.voided is distinct from old.voided or new.void_reason is distinct from old.void_reason
      or (new.status = 'void' and old.status is distinct from new.status)) then
    if auth.uid() is not null and not fn_has_permission('expenses.delete') then
      raise exception 'permission denied: expenses.delete required to void an expense';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_expense_void on expenses;
create trigger trg_guard_expense_void
  before update on expenses
  for each row execute function fn_guard_expense_void_columns();

create or replace function public.fn_guard_invoice_void_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (new.status = 'void' and old.status is distinct from new.status) or (new.void_reason is distinct from old.void_reason) then
    if auth.uid() is not null and not fn_has_permission('invoices.delete') then
      raise exception 'permission denied: invoices.delete required to void an invoice';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_invoice_void on invoices;
create trigger trg_guard_invoice_void
  before update on invoices
  for each row execute function fn_guard_invoice_void_columns();

-- payments have NO update policy at all today (verified: p_payments_select
-- and p_payments_insert are the only two policies), i.e. payments are
-- fully immutable once created. Voiding needs an UPDATE, so add one — but
-- scoped so it can only ever touch the void columns, never amount/
-- customer_id/method/etc, preserving that immutability for anything else.
create or replace function public.fn_guard_payment_void_only()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (new.amount is distinct from old.amount or new.customer_id is distinct from old.customer_id
      or new.payment_date is distinct from old.payment_date or new.method is distinct from old.method
      or new.cash_account_id is distinct from old.cash_account_id or new.receipt_no is distinct from old.receipt_no) then
    raise exception 'payments are immutable except for voiding — record a new payment instead of editing this one';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_payment_void_only on payments;
create trigger trg_guard_payment_void_only
  before update on payments
  for each row execute function fn_guard_payment_void_only();

drop policy if exists p_payments_update_void on payments;
create policy p_payments_update_void on payments
  for update
  using (fn_has_permission('payments.delete'))
  with check (fn_has_permission('payments.delete'));

-- One SECURITY DEFINER function per module does the whole void operation
-- atomically (status flip + reversing journal entry + reversing ledger/
-- cash rows), mirroring how post_journal/fn_post_payment_to_ledger/etc
-- already work in this schema — post_journal itself has no execute grant
-- to `authenticated` (only callable from another SECURITY DEFINER
-- function), so the app layer can't call it directly anyway. Each function
-- re-checks the permission internally (defense in depth beneath the RLS/
-- trigger guards above) and requires a non-empty reason.

create or replace function public.fn_void_expense(p_expense_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  exp record;
  cash_code text;
  exp_code text;
begin
  if not fn_has_permission('expenses.delete') then
    raise exception 'permission denied: expenses.delete required to void an expense';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required to void an expense';
  end if;

  select * into exp from expenses where id = p_expense_id for update;
  if exp is null then raise exception 'expense not found'; end if;
  if exp.voided then raise exception 'this expense is already voided'; end if;

  update expenses set voided = true, void_reason = p_reason, voided_at = now(), voided_by = auth.uid(), status = 'void'
  where id = p_expense_id;

  if exp.status in ('approved', 'paid') and exists (select 1 from journal_entries where source_module = 'expenses' and source_id = p_expense_id) then
    cash_code := case when exp.payment_method = 'bank' then '1010' else '1000' end;
    select account_code into exp_code from expense_category_account_map where category_id = exp.category_id;
    if exp_code is null then exp_code := '6900'; end if;
    perform post_journal(current_date, exp.expense_no, 'VOID: ' || exp.description || ' — ' || p_reason, 'expenses', p_expense_id, auth.uid(),
      jsonb_build_array(
        jsonb_build_object('account', cash_code, 'debit', exp.amount, 'credit', 0),
        jsonb_build_object('account', exp_code, 'debit', 0, 'credit', exp.amount)
      ));
  end if;
end;
$function$;

grant execute on function public.fn_void_expense(uuid, text) to authenticated;

create or replace function public.fn_void_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  pay record;
  cash_code text;
begin
  if not fn_has_permission('payments.delete') then
    raise exception 'permission denied: payments.delete required to void a payment';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required to void a payment';
  end if;

  select * into pay from payments where id = p_payment_id for update;
  if pay is null then raise exception 'payment not found'; end if;
  if pay.voided then raise exception 'this payment is already voided'; end if;

  update payments set voided = true, void_reason = p_reason, voided_at = now(), voided_by = auth.uid()
  where id = p_payment_id;

  insert into customer_ledger_entries (customer_id, entry_date, reference_type, reference_id, description, debit, credit, created_by)
  values (pay.customer_id, current_date, 'payment_void', pay.id, 'VOID: Payment ' || pay.receipt_no || ' — ' || p_reason, pay.amount, 0, auth.uid());

  if pay.cash_account_id is not null then
    insert into cash_transactions (account_id, txn_date, type, amount, reference_type, reference_id, description, created_by)
    values (pay.cash_account_id, current_date, 'adjustment', -pay.amount, 'payment_void', pay.id, 'VOID: Payment ' || pay.receipt_no || ' — ' || p_reason, auth.uid());
  end if;

  cash_code := case when pay.method = 'bank' then '1010' else '1000' end;
  perform post_journal(current_date, pay.receipt_no, 'VOID: Payment received — ' || p_reason, 'payments', pay.id, auth.uid(),
    jsonb_build_array(
      jsonb_build_object('account', '1100', 'debit', pay.amount, 'credit', 0),
      jsonb_build_object('account', cash_code, 'debit', 0, 'credit', pay.amount)
    ));
end;
$function$;

grant execute on function public.fn_void_payment(uuid, text) to authenticated;

create or replace function public.fn_void_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  inv record;
begin
  if not fn_has_permission('invoices.delete') then
    raise exception 'permission denied: invoices.delete required to void an invoice';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required to void an invoice';
  end if;

  select * into inv from invoices where id = p_invoice_id for update;
  if inv is null then raise exception 'invoice not found'; end if;
  if inv.status = 'void' then raise exception 'this invoice is already void'; end if;
  if inv.status in ('paid', 'partially_paid') then
    raise exception 'this invoice has payments applied — void or reverse the related payment(s) first';
  end if;

  update invoices set status = 'void', void_reason = p_reason, voided_at = now(), voided_by = auth.uid()
  where id = p_invoice_id;

  if exists (select 1 from customer_ledger_entries where reference_type = 'invoice' and reference_id = p_invoice_id) then
    insert into customer_ledger_entries (customer_id, entry_date, reference_type, reference_id, description, debit, credit, created_by)
    values (inv.customer_id, current_date, 'invoice_void', inv.id, 'VOID: Invoice ' || inv.invoice_no || ' — ' || p_reason, 0, inv.net_amount, auth.uid());
  end if;

  if inv.net_amount <> 0 then
    perform post_journal(current_date, inv.invoice_no, 'VOID: Invoice raised — ' || p_reason, 'invoices', inv.id, auth.uid(),
      jsonb_build_array(
        jsonb_build_object('account', '4000', 'debit', inv.net_amount, 'credit', 0),
        jsonb_build_object('account', '1100', 'debit', 0, 'credit', inv.net_amount)
      ));
  end if;
end;
$function$;

grant execute on function public.fn_void_invoice(uuid, text) to authenticated;
