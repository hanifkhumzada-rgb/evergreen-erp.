-- Daily Closing + Credit/Debit Adjustment documents.
-- ADDITIVE ONLY: two new tables, their policies/triggers/indexes, and two
-- SECURITY DEFINER posting functions. No existing table, column or row is
-- changed. Existing daily closings (cash_transactions, reference_type
-- 'daily_closing') are left as they are and remain readable by the app.

-- ---------------------------------------------------------------------------
-- 1. daily_closings — one closing per business per day
-- ---------------------------------------------------------------------------
create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  closing_no text not null,
  close_date date not null,
  opening_cash numeric(14,2) not null default 0,
  sales_total numeric(14,2) not null default 0,
  collections_total numeric(14,2) not null default 0,
  cash_collections numeric(14,2) not null default 0,
  expenses_total numeric(14,2) not null default 0,
  cash_expenses numeric(14,2) not null default 0,
  expected_cash numeric(14,2) not null default 0,
  actual_cash numeric(14,2) not null default 0,
  difference numeric(14,2) generated always as (actual_cash - expected_cash) stored,
  difference_reason text,
  deliveries_count integer not null default 0,
  bottles_delivered integer not null default 0,
  empty_returned integer not null default 0,
  missed_deliveries integer not null default 0,
  status text not null default 'closed' check (status in ('closed', 'approved', 'rejected')),
  notes text,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, close_date),
  unique (business_id, closing_no)
);

create index if not exists idx_daily_closings_business_date on public.daily_closings(business_id, close_date desc);
create trigger trg_stamp_business_id before insert on public.daily_closings for each row execute function public.fn_stamp_business_id();

alter table public.daily_closings enable row level security;
create policy p_business_isolation on public.daily_closings as restrictive for all
  using (business_id = (select public.fn_current_business_id()))
  with check (business_id = (select public.fn_current_business_id()));
create policy p_daily_closings_select on public.daily_closings for select
  using ((select public.fn_has_permission('cash.view')) or (select public.fn_has_permission('reports.view')));
create policy p_daily_closings_insert on public.daily_closings for insert
  with check ((select public.fn_has_permission('cash.manage')) and closed_by = (select auth.uid()) and status = 'closed' and approved_by is null);
-- Approval/rejection is done only through fn_review_daily_closing (owner/admin).

-- Approve or reject a closing. Owner/Admin only; the closer cannot approve
-- their own closing unless they are the Owner.
create or replace function public.fn_review_daily_closing(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.daily_closings;
  v_role text := public.fn_current_role_key();
begin
  if v_role not in ('owner', 'admin') then
    raise exception 'Only the Owner or an Admin can review a daily closing';
  end if;
  select * into v_row from public.daily_closings where id = p_id and business_id = public.fn_current_business_id() for update;
  if not found then raise exception 'Daily closing not found'; end if;
  if v_row.status <> 'closed' then raise exception 'This closing has already been reviewed'; end if;
  if v_row.closed_by = auth.uid() and v_role <> 'owner' then
    raise exception 'A closing must be approved by someone other than the person who closed it';
  end if;
  update public.daily_closings
     set status = case when p_approve then 'approved' else 'rejected' end,
         approved_by = auth.uid(), approved_at = now(),
         notes = coalesce(nullif(btrim(p_note), ''), notes)
   where id = p_id;
  insert into public.audit_logs (user_id, action, module, record_id, new_value, business_id)
  values (auth.uid(), case when p_approve then 'APPROVE' else 'REJECT' end, 'daily_closings', p_id::text,
          jsonb_build_object('close_date', v_row.close_date, 'note', nullif(btrim(p_note), '')), v_row.business_id);
end;
$$;
revoke execute on function public.fn_review_daily_closing(uuid, boolean, text) from public, anon;
grant execute on function public.fn_review_daily_closing(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. customer_adjustments — Credit / Debit adjustment documents
-- ---------------------------------------------------------------------------
create table if not exists public.customer_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  adjustment_no text not null,
  customer_id uuid not null references public.customers(id),
  adjustment_date date not null default current_date,
  adjustment_type text not null check (adjustment_type in ('credit', 'debit')),
  amount numeric(14,2) not null check (amount > 0),
  bottles integer not null default 0,
  reason text not null check (length(btrim(reason)) >= 5),
  reference text,
  status text not null default 'posted' check (status in ('posted', 'void')),
  ledger_entry_id uuid references public.customer_ledger_entries(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, adjustment_no)
);

create index if not exists idx_customer_adjustments_customer_date on public.customer_adjustments(customer_id, adjustment_date);
create index if not exists idx_customer_adjustments_business_date on public.customer_adjustments(business_id, adjustment_date desc);
create trigger trg_stamp_business_id before insert on public.customer_adjustments for each row execute function public.fn_stamp_business_id();

alter table public.customer_adjustments enable row level security;
create policy p_business_isolation on public.customer_adjustments as restrictive for all
  using (business_id = (select public.fn_current_business_id()))
  with check (business_id = (select public.fn_current_business_id()));
create policy p_customer_adjustments_select on public.customer_adjustments for select
  using ((select public.fn_has_permission('payments.view')) or (select public.fn_has_permission('customers.manage_financial')));
-- No direct INSERT/UPDATE/DELETE policy: documents are created only through
-- fn_post_customer_adjustment so the ledger posting can never be skipped.

-- Creates the adjustment document AND its ledger posting atomically.
--   credit → reduces what the customer owes (ledger credit)
--   debit  → increases what the customer owes (ledger debit)
create or replace function public.fn_post_customer_adjustment(
  p_customer_id uuid, p_type text, p_amount numeric, p_date date, p_reason text, p_reference text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_business uuid := public.fn_current_business_id();
  v_prefix text := case when p_type = 'credit' then 'CN-' else 'DN-' end;
  v_no text;
  v_id uuid;
  v_ledger uuid;
begin
  if not public.fn_has_permission('customers.manage_financial') then
    raise exception 'You do not have permission to post customer adjustments';
  end if;
  if p_type not in ('credit', 'debit') then raise exception 'Adjustment type must be credit or debit'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Give a reason (at least 5 characters)'; end if;
  if not exists (select 1 from public.customers where id = p_customer_id and business_id = v_business) then
    raise exception 'Customer not found';
  end if;

  perform pg_advisory_xact_lock(hashtext('customer_adjustment_no:' || v_business::text));
  select v_prefix || lpad((coalesce(max(substring(adjustment_no from '[0-9]+$')::int), 0) + 1)::text, 6, '0')
    into v_no from public.customer_adjustments
   where business_id = v_business and adjustment_no like v_prefix || '%';

  insert into public.customer_adjustments (business_id, adjustment_no, customer_id, adjustment_date, adjustment_type, amount, reason, reference, created_by)
  values (v_business, v_no, p_customer_id, coalesce(p_date, current_date), p_type, round(p_amount, 2), btrim(p_reason), nullif(btrim(p_reference), ''), auth.uid())
  returning id into v_id;

  insert into public.customer_ledger_entries (business_id, customer_id, entry_date, reference_type, reference_id, description, debit, credit, created_by, remarks)
  values (v_business, p_customer_id, coalesce(p_date, current_date),
          case when p_type = 'credit' then 'credit_note' else 'debit_note' end, v_id,
          (case when p_type = 'credit' then 'Credit adjustment ' else 'Debit adjustment ' end) || v_no,
          case when p_type = 'debit' then round(p_amount, 2) else 0 end,
          case when p_type = 'credit' then round(p_amount, 2) else 0 end,
          auth.uid(), btrim(p_reason))
  returning id into v_ledger;

  update public.customer_adjustments set ledger_entry_id = v_ledger where id = v_id;
  insert into public.audit_logs (user_id, action, module, record_id, new_value, business_id)
  values (auth.uid(), 'CREATE', 'customer_adjustments', v_id::text,
          jsonb_build_object('adjustment_no', v_no, 'type', p_type, 'amount', p_amount, 'reason', btrim(p_reason)), v_business);
  return v_id;
end;
$$;
revoke execute on function public.fn_post_customer_adjustment(uuid, text, numeric, date, text, text) from public, anon;
grant execute on function public.fn_post_customer_adjustment(uuid, text, numeric, date, text, text) to authenticated;
