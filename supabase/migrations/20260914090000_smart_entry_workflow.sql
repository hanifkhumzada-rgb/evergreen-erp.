-- Smart Entry is a staging/approval boundary. Draft, pending, rejected and
-- failed rows never touch operational or financial tables. Existing module
-- actions post only after approval/success and write the resulting link here.
create sequence if not exists public.smart_entry_no_seq start 1;

create table if not exists public.smart_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  entry_no text not null,
  entry_type text not null check (entry_type in ('customer','delivery','payment','expense','bottle','inventory_purchase','employee_salary','invoice_adjustment','complaint_feedback')),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','rejected','failed')),
  payload jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  idempotency_key text not null,
  source text not null default 'single' check (source in ('single','bulk','import')),
  linked_record_type text,
  linked_record_id uuid,
  created_by uuid not null references public.profiles(id),
  submitted_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejected_by uuid references public.profiles(id),
  rejected_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, entry_no),
  unique (business_id, idempotency_key)
);

create table if not exists public.smart_entry_approval_rules (
  business_id uuid not null references public.businesses(id),
  entry_type text not null check (entry_type in ('customer','delivery','payment','expense','bottle','inventory_purchase','employee_salary','invoice_adjustment','complaint_feedback')),
  requires_approval boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (business_id, entry_type)
);

insert into public.smart_entry_approval_rules(business_id,entry_type,requires_approval)
select b.id,t.entry_type,t.requires_approval from public.businesses b cross join (values
 ('customer',false),('delivery',false),('payment',true),('expense',true),('bottle',true),
 ('inventory_purchase',true),('employee_salary',true),('invoice_adjustment',true),('complaint_feedback',false)
) as t(entry_type,requires_approval) on conflict do nothing;

alter table public.smart_entries enable row level security;
alter table public.smart_entry_approval_rules enable row level security;

drop policy if exists p_smart_entries_select on public.smart_entries;
create policy p_smart_entries_select on public.smart_entries for select to authenticated
using (business_id=public.fn_current_business_id());
drop policy if exists p_smart_entries_insert on public.smart_entries;
create policy p_smart_entries_insert on public.smart_entries for insert to authenticated
with check (business_id=public.fn_current_business_id() and created_by=(select auth.uid()));
drop policy if exists p_smart_entries_update on public.smart_entries;
create policy p_smart_entries_update on public.smart_entries for update to authenticated
using (business_id=public.fn_current_business_id() and (created_by=(select auth.uid()) or public.fn_has_permission('settings.manage')))
with check (business_id=public.fn_current_business_id() and (created_by=(select auth.uid()) or public.fn_has_permission('settings.manage')));
drop policy if exists p_smart_entries_delete on public.smart_entries;
create policy p_smart_entries_delete on public.smart_entries for delete to authenticated
using (business_id=public.fn_current_business_id() and public.fn_has_permission('settings.manage') and status <> 'approved');

drop policy if exists p_smart_rules_select on public.smart_entry_approval_rules;
create policy p_smart_rules_select on public.smart_entry_approval_rules for select to authenticated
using (business_id=public.fn_current_business_id());
drop policy if exists p_smart_rules_manage on public.smart_entry_approval_rules;
create policy p_smart_rules_manage on public.smart_entry_approval_rules for all to authenticated
using (business_id=public.fn_current_business_id() and public.fn_has_permission('settings.manage'))
with check (business_id=public.fn_current_business_id() and public.fn_has_permission('settings.manage'));

create index if not exists idx_smart_entries_business_status_created on public.smart_entries(business_id,status,created_at desc);
create index if not exists idx_smart_entries_business_type_created on public.smart_entries(business_id,entry_type,created_at desc);
create index if not exists idx_smart_entries_payload_customer on public.smart_entries((payload->>'customer_id')) where payload ? 'customer_id';
create index if not exists idx_deliveries_business_customer_date on public.deliveries(business_id,customer_id,delivery_date desc);
create index if not exists idx_ledger_business_customer_date on public.customer_ledger_entries(business_id,customer_id,entry_date,created_at);
create index if not exists idx_payments_business_customer_date on public.payments(business_id,customer_id,payment_date desc) where voided=false;
create index if not exists idx_bottle_txn_business_customer_date on public.bottle_transactions(business_id,customer_id,txn_date,created_at) where customer_id is not null;

grant select,insert,update,delete on public.smart_entries to authenticated;
grant select,insert,update,delete on public.smart_entry_approval_rules to authenticated;
grant usage,select on sequence public.smart_entry_no_seq to authenticated;
