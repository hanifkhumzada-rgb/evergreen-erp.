-- ============================================================
-- SMART ENTRY ENGINE
-- Unified entry hub for Customer / Delivery / Payment / Expense / Bottle /
-- Inventory Purchase / Employee Salary / Invoice-Adjustment /
-- Complaint-Feedback, with Draft -> Pending Approval -> Approved/Rejected/
-- Failed lifecycle and one automatic poster per type.
--
-- Section 0 is a documentation catch-up only: `smart_entries` and
-- `smart_entry_approval_rules` already exist in production (provisioned
-- ahead of this migration, never captured in tracked history) — every
-- statement there is IF NOT EXISTS / DROP+CREATE-identical so it is a
-- verified no-op against the live database and only matters for building a
-- fresh environment from supabase/migrations from scratch.
-- ============================================================

-- ---------- 0. Catch-up: smart_entries / smart_entry_approval_rules ----------
create table if not exists smart_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  entry_no text not null,
  entry_type text not null check (entry_type = any (array['customer','delivery','payment','expense','bottle','inventory_purchase','employee_salary','invoice_adjustment','complaint_feedback'])),
  status text not null default 'draft' check (status = any (array['draft','pending_approval','approved','rejected','failed'])),
  payload jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  idempotency_key text not null,
  source text not null default 'single' check (source = any (array['single','bulk','import'])),
  linked_record_type text,
  linked_record_id uuid,
  created_by uuid not null references profiles(id),
  submitted_at timestamptz,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  rejected_by uuid references profiles(id),
  rejected_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, entry_no),
  unique (business_id, idempotency_key)
);
create index if not exists idx_smart_entries_business_status_created on smart_entries(business_id, status, created_at);
create index if not exists idx_smart_entries_business_type_created on smart_entries(business_id, entry_type, created_at);
create index if not exists idx_smart_entries_payload_customer on smart_entries (((payload ->> 'customer_id')));

create table if not exists smart_entry_approval_rules (
  business_id uuid not null references businesses(id),
  entry_type text not null check (entry_type = any (array['customer','delivery','payment','expense','bottle','inventory_purchase','employee_salary','invoice_adjustment','complaint_feedback'])),
  requires_approval boolean not null default false,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  primary key (business_id, entry_type)
);

alter table smart_entries enable row level security;
alter table smart_entry_approval_rules enable row level security;

drop policy if exists p_smart_entries_select on smart_entries;
create policy p_smart_entries_select on smart_entries for select using (business_id = fn_current_business_id());
drop policy if exists p_smart_entries_insert on smart_entries;
create policy p_smart_entries_insert on smart_entries for insert with check (business_id = fn_current_business_id() and created_by = auth.uid());
drop policy if exists p_smart_entries_update on smart_entries;
create policy p_smart_entries_update on smart_entries for update
  using (business_id = fn_current_business_id() and (created_by = auth.uid() or fn_has_permission('settings.manage')))
  with check (business_id = fn_current_business_id() and (created_by = auth.uid() or fn_has_permission('settings.manage')));
drop policy if exists p_smart_entries_delete on smart_entries;
create policy p_smart_entries_delete on smart_entries for delete using (business_id = fn_current_business_id() and fn_has_permission('settings.manage') and status <> 'approved');

drop policy if exists p_smart_rules_select on smart_entry_approval_rules;
create policy p_smart_rules_select on smart_entry_approval_rules for select using (business_id = fn_current_business_id());
drop policy if exists p_smart_rules_manage on smart_entry_approval_rules;
create policy p_smart_rules_manage on smart_entry_approval_rules for all
  using (business_id = fn_current_business_id() and fn_has_permission('settings.manage'))
  with check (business_id = fn_current_business_id() and fn_has_permission('settings.manage'));

-- ---------- 1. Reference numbering + ledger linkage columns ----------
alter table business_settings add column if not exists expense_prefix text not null default 'EGW-EXP-';
alter table business_settings add column if not exists next_expense_number integer not null default 1;
alter table business_settings add column if not exists purchase_prefix text not null default 'EGW-PUR-';
alter table business_settings add column if not exists next_purchase_number integer not null default 1;
alter table business_settings add column if not exists smart_entry_prefix text not null default 'SE-';
alter table business_settings add column if not exists next_smart_entry_number integer not null default 1;

create or replace function public.fn_next_expense_no() returns text language sql set search_path to 'public' as $$ select fn_next_number('expense_prefix','next_expense_number'); $$;
grant execute on function public.fn_next_expense_no() to authenticated;

create or replace function public.fn_next_purchase_no() returns text language sql set search_path to 'public' as $$ select fn_next_number('purchase_prefix','next_purchase_number'); $$;
grant execute on function public.fn_next_purchase_no() to authenticated;

create or replace function public.fn_next_smart_entry_no() returns text language sql set search_path to 'public' as $$ select fn_next_number('smart_entry_prefix','next_smart_entry_number'); $$;
grant execute on function public.fn_next_smart_entry_no() to authenticated;

alter table customer_ledger_entries add column if not exists smart_entry_id uuid references smart_entries(id);
alter table customer_ledger_entries add column if not exists bottles_out integer;
alter table customer_ledger_entries add column if not exists bottles_in integer;
alter table customer_ledger_entries add column if not exists remarks text;
create index if not exists idx_cle_smart_entry on customer_ledger_entries(smart_entry_id);

-- ---------- 2. Permissions ----------
insert into permissions (key, module, description) values
  ('smart_entry.view', 'smart_entry', 'Open Smart Entry and view submitted entries'),
  ('smart_entry.approve', 'smart_entry', 'Approve or reject Smart Entry submissions'),
  ('employees.manage', 'employees', 'Manage employees, salary payments and advances')
on conflict (key) do nothing;

-- role_permissions carries a generic audit trigger that resolves
-- business_id via auth.uid() (the acting user's profile) — there is no
-- authenticated user in a migration/service-role context, so that
-- resolution comes back null and the NOT NULL audit_logs.business_id
-- constraint rejects it. role_permissions is a global (non-tenant-scoped)
-- table anyway, so this bulk permission seeding doesn't need an audit
-- trail entry; disable the trigger for just these three seed inserts.
alter table role_permissions disable trigger trg_audit_role_permissions;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key in ('owner','admin','manager','accountant','rider') and p.key = 'smart_entry.view'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key in ('owner','admin') and p.key = 'smart_entry.approve'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key in ('owner','admin','manager') and p.key = 'employees.manage'
on conflict do nothing;

alter table role_permissions enable trigger trg_audit_role_permissions;

-- ---------- 3. Approval-rules seed (nothing forced by default; forced cases are hardcoded in fn_validate_smart_entry) ----------
insert into smart_entry_approval_rules (business_id, entry_type, requires_approval)
select b.id, t.entry_type, false
from businesses b cross join (values ('customer'),('delivery'),('payment'),('expense'),('bottle'),('inventory_purchase'),('employee_salary'),('invoice_adjustment'),('complaint_feedback')) as t(entry_type)
on conflict (business_id, entry_type) do nothing;

-- ---------- 4. Helper: resolve a customer's product rate ----------
create or replace function public.fn_resolve_product_rate(p_customer_id uuid, p_product_id uuid, p_asof date default current_date)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select price from customer_prices where customer_id = p_customer_id and product_id = p_product_id
       and effective_from <= p_asof and (effective_to is null or effective_to >= p_asof)
       order by effective_from desc limit 1),
    (select price from product_prices where product_id = p_product_id
       and effective_from <= p_asof and (effective_to is null or effective_to >= p_asof)
       order by effective_from desc limit 1)
  );
$$;
grant execute on function public.fn_resolve_product_rate(uuid, uuid, date) to authenticated;

-- ---------- 5. FIFO ageing for a customer ----------
create or replace function public.fn_customer_ageing(p_customer_id uuid, p_asof date default current_date)
returns table(current_amt numeric, d1_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric, total_outstanding numeric)
language sql stable security definer set search_path to 'public' as $$
  with debits as (
    select id, entry_date, debit as amt,
      sum(debit) over (order by entry_date, created_at, id) as cum_debit
    from customer_ledger_entries where customer_id = p_customer_id and debit > 0
  ), tot as (
    select coalesce(sum(credit),0) as total_credit from customer_ledger_entries where customer_id = p_customer_id
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
$$;
grant execute on function public.fn_customer_ageing(uuid, date) to authenticated;

-- ---------- 6. Validation (internal — wrapped by fn_smart_entry_check for read-only client use) ----------
create or replace function public.fn_validate_smart_entry(p_entry_type text, p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_business_id uuid := fn_current_business_id();
  v_errors jsonb := '{}'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_force_approval boolean := false;
  v_customer customers%rowtype;
  v_amount numeric;
  v_qty numeric;
  v_empty numeric;
  v_product_id uuid;
  v_rate numeric;
  v_default_rate numeric;
  v_dup_count int;
  v_balance numeric;
  v_threshold record;
begin
  if p_entry_type = 'customer' then
    if coalesce(btrim(p_payload->>'name'),'') = '' then
      v_errors := v_errors || jsonb_build_object('name','Customer name is required');
    end if;
    if coalesce(btrim(p_payload->>'mobile'),'') = '' then
      v_errors := v_errors || jsonb_build_object('mobile','Mobile number is required');
    elsif exists (select 1 from customers where business_id = v_business_id and mobile = btrim(p_payload->>'mobile')) then
      v_errors := v_errors || jsonb_build_object('mobile','A customer with this mobile number already exists');
    end if;

  elsif p_entry_type = 'delivery' then
    if nullif(p_payload->>'customer_id','') is null then
      v_errors := v_errors || jsonb_build_object('customer_id','Customer is required');
    else
      select * into v_customer from customers where id = (p_payload->>'customer_id')::uuid and business_id = v_business_id;
      if not found then
        v_errors := v_errors || jsonb_build_object('customer_id','Customer not found');
      elsif v_customer.status <> 'active' then
        v_warnings := v_warnings || to_jsonb('Customer is inactive — this delivery needs owner approval'::text);
        v_force_approval := true;
      end if;
    end if;
    if nullif(p_payload->>'delivery_date','') is null then
      v_errors := v_errors || jsonb_build_object('delivery_date','Delivery date is required');
    end if;
    v_qty := nullif(p_payload->>'delivered_qty','')::numeric;
    if v_qty is null or v_qty <= 0 then
      v_errors := v_errors || jsonb_build_object('delivered_qty','Delivered quantity must be greater than zero');
    end if;
    v_empty := coalesce(nullif(p_payload->>'empty_received','')::numeric, 0);
    if v_empty < 0 then
      v_errors := v_errors || jsonb_build_object('empty_received','Empty bottles received cannot be negative');
    end if;
    v_product_id := nullif(p_payload->>'product_id','')::uuid;
    if v_product_id is null then
      v_errors := v_errors || jsonb_build_object('product_id','Product is required');
    end if;
    if v_customer.id is not null and v_product_id is not null then
      v_default_rate := fn_resolve_product_rate(v_customer.id, v_product_id, coalesce(nullif(p_payload->>'delivery_date','')::date, current_date));
      v_rate := nullif(p_payload->>'unit_price','')::numeric;
      if v_rate is not null and v_default_rate is not null and v_rate <> v_default_rate then
        if not fn_has_permission('customers.manage_financial') then
          v_errors := v_errors || jsonb_build_object('unit_price','Only authorized users may override the rate');
        elsif coalesce(btrim(p_payload->>'rate_override_reason'),'') = '' then
          v_errors := v_errors || jsonb_build_object('rate_override_reason','A reason is required to override the rate');
        end if;
      end if;
      if v_rate is null and v_default_rate is null then
        v_errors := v_errors || jsonb_build_object('unit_price','No rate configured for this customer/product — enter a rate');
      end if;
      if v_qty is not null and nullif(p_payload->>'delivery_date','') is not null then
        select count(*) into v_dup_count from deliveries d
        where d.customer_id = v_customer.id and d.delivery_date = (p_payload->>'delivery_date')::date and d.status <> 'void'
          and exists (select 1 from delivery_items di where di.delivery_id = d.id and di.product_id = v_product_id and di.delivered_qty = v_qty);
        if v_dup_count > 0 then
          v_warnings := v_warnings || to_jsonb('A delivery for this customer, date and quantity already exists (possible duplicate)'::text);
        end if;
      end if;
    end if;

  elsif p_entry_type = 'payment' then
    if nullif(p_payload->>'customer_id','') is null then
      v_errors := v_errors || jsonb_build_object('customer_id','Customer is required');
    end if;
    v_amount := nullif(p_payload->>'amount','')::numeric;
    if v_amount is null or v_amount <= 0 then
      v_errors := v_errors || jsonb_build_object('amount','Amount must be greater than zero');
    end if;
    if nullif(p_payload->>'payment_date','') is null then
      v_errors := v_errors || jsonb_build_object('payment_date','Payment date is required');
    end if;
    if nullif(p_payload->>'method','') is null then
      v_errors := v_errors || jsonb_build_object('method','Payment mode is required');
    end if;
    if nullif(p_payload->>'reference','') is not null and nullif(p_payload->>'customer_id','') is not null then
      if exists (select 1 from payments where customer_id = (p_payload->>'customer_id')::uuid and reference = (p_payload->>'reference') and voided = false) then
        v_errors := v_errors || jsonb_build_object('reference','A payment with this reference already exists for this customer');
      end if;
    end if;

  elsif p_entry_type = 'expense' then
    if nullif(p_payload->>'category_id','') is null then
      v_errors := v_errors || jsonb_build_object('category_id','Category is required');
    end if;
    if nullif(p_payload->>'expense_date','') is null then
      v_errors := v_errors || jsonb_build_object('expense_date','Date is required');
    end if;
    v_amount := nullif(p_payload->>'amount','')::numeric;
    if v_amount is null or v_amount <= 0 then
      v_errors := v_errors || jsonb_build_object('amount','Amount must be greater than zero');
    else
      select enabled, threshold_value into v_threshold from automation_rules where business_id = v_business_id and key = 'expense_approval_threshold';
      if v_threshold.enabled and v_amount > v_threshold.threshold_value then
        v_force_approval := true;
        v_warnings := v_warnings || to_jsonb('Amount exceeds the configured approval limit — owner approval required'::text);
      end if;
    end if;

  elsif p_entry_type = 'bottle' then
    if nullif(p_payload->>'customer_id','') is null then
      v_errors := v_errors || jsonb_build_object('customer_id','Customer is required');
    end if;
    if nullif(p_payload->>'product_id','') is null then
      v_errors := v_errors || jsonb_build_object('product_id','Product is required');
    end if;
    if coalesce((p_payload->>'delivered_qty')::numeric,0) < 0 or coalesce((p_payload->>'returned_qty')::numeric,0) < 0
       or coalesce((p_payload->>'damaged_qty')::numeric,0) < 0 or coalesce((p_payload->>'lost_qty')::numeric,0) < 0 then
      v_errors := v_errors || jsonb_build_object('quantity','Quantities cannot be negative');
    end if;
    if (p_payload->>'adjustment_qty') is not null and (p_payload->>'adjustment_qty')::numeric <> 0 then
      if coalesce(btrim(p_payload->>'adjustment_reason'),'') = '' then
        v_errors := v_errors || jsonb_build_object('adjustment_reason','A reason is required for a bottle adjustment');
      end if;
      v_force_approval := true;
    end if;
    if nullif(p_payload->>'customer_id','') is not null and nullif(p_payload->>'product_id','') is not null then
      select bottles_with_customer into v_balance from v_customer_bottle_balance
        where customer_id = (p_payload->>'customer_id')::uuid and product_id = (p_payload->>'product_id')::uuid;
      v_balance := coalesce(v_balance, 0);
      if (coalesce((p_payload->>'returned_qty')::numeric,0) + coalesce((p_payload->>'damaged_qty')::numeric,0) + coalesce((p_payload->>'lost_qty')::numeric,0)
          - greatest(coalesce((p_payload->>'adjustment_qty')::numeric,0),0)) > v_balance then
        v_errors := v_errors || jsonb_build_object('returned_qty', format('This would take the customer bottle balance negative (currently %s with customer)', v_balance));
      end if;
    end if;

  elsif p_entry_type = 'inventory_purchase' then
    if nullif(p_payload->>'supplier_id','') is null and coalesce(btrim(p_payload->>'supplier_name'),'') = '' then
      v_errors := v_errors || jsonb_build_object('supplier_id','Supplier is required');
    end if;
    if nullif(p_payload->>'purchase_date','') is null then
      v_errors := v_errors || jsonb_build_object('purchase_date','Purchase date is required');
    end if;
    if jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb)) = 0 then
      v_errors := v_errors || jsonb_build_object('items','Add at least one item');
    end if;

  elsif p_entry_type = 'employee_salary' then
    if nullif(p_payload->>'employee_id','') is null then
      v_errors := v_errors || jsonb_build_object('employee_id','Employee is required');
    end if;
    if nullif(p_payload->>'period_month','') is null then
      v_errors := v_errors || jsonb_build_object('period_month','Salary month is required');
    end if;
    v_amount := nullif(p_payload->>'net_paid','')::numeric;
    if v_amount is null or v_amount <= 0 then
      v_errors := v_errors || jsonb_build_object('net_paid','Net paid must be greater than zero');
    end if;

  elsif p_entry_type = 'invoice_adjustment' then
    if nullif(p_payload->>'customer_id','') is null then
      v_errors := v_errors || jsonb_build_object('customer_id','Customer is required');
    end if;
    if nullif(p_payload->>'invoice_date','') is null then
      v_errors := v_errors || jsonb_build_object('invoice_date','Date is required');
    end if;
    if jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb)) = 0 then
      v_errors := v_errors || jsonb_build_object('items','Add at least one line item');
    end if;
    if coalesce(p_payload->>'adjustment_type','invoice') = 'credit_note' then
      v_force_approval := true;
    end if;

  elsif p_entry_type = 'complaint_feedback' then
    if nullif(p_payload->>'customer_id','') is null then
      v_errors := v_errors || jsonb_build_object('customer_id','Customer is required');
    end if;
    if coalesce(p_payload->>'kind','complaint') = 'complaint' then
      if coalesce(btrim(p_payload->>'subject'),'') = '' then
        v_errors := v_errors || jsonb_build_object('subject','Subject is required');
      end if;
    else
      if nullif(p_payload->>'overall_rating','') is null then
        v_errors := v_errors || jsonb_build_object('overall_rating','Overall rating is required');
      end if;
    end if;
  else
    v_errors := v_errors || jsonb_build_object('entry_type','Unknown entry type');
  end if;

  return jsonb_build_object('errors', v_errors, 'warnings', v_warnings, 'force_approval', v_force_approval);
end;
$function$;

create or replace function public.fn_smart_entry_check(p_entry_type text, p_payload jsonb)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select fn_validate_smart_entry(p_entry_type, p_payload);
$$;
grant execute on function public.fn_smart_entry_check(text, jsonb) to authenticated;

-- ---------- 7. Required permission per entry type (creation) ----------
create or replace function public.fn_smart_entry_required_permission(p_entry_type text)
returns text language sql immutable as $$
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
$$;

-- ---------- 8. Create (draft) ----------
create or replace function public.fn_smart_entry_create(p_entry_type text, p_payload jsonb, p_source text default 'single', p_idempotency_key text default null)
returns smart_entries
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_business_id uuid := fn_current_business_id();
  v_perm text := fn_smart_entry_required_permission(p_entry_type);
  v_row smart_entries;
  v_key text := coalesce(p_idempotency_key, gen_random_uuid()::text);
begin
  if v_business_id is null then
    raise exception 'Your account is not assigned to a business';
  end if;
  if v_perm is null or not fn_has_permission(v_perm) then
    raise exception 'permission denied: % required for this entry type', coalesce(v_perm, 'a permission');
  end if;
  if fn_current_role_key() = 'rider' and p_entry_type not in ('delivery','bottle') then
    raise exception 'permission denied: delivery staff can only record deliveries and bottle returns';
  end if;

  insert into smart_entries (business_id, entry_no, entry_type, status, payload, source, idempotency_key, created_by)
  values (v_business_id, fn_next_smart_entry_no(), p_entry_type, 'draft', coalesce(p_payload,'{}'::jsonb), coalesce(p_source,'single'), v_key, auth.uid())
  on conflict (business_id, idempotency_key) do update set updated_at = smart_entries.updated_at
  returning * into v_row;

  return v_row;
end;
$function$;
grant execute on function public.fn_smart_entry_create(text, jsonb, text, text) to authenticated;

-- ---------- 9. Update payload (edit & retry / edit draft) ----------
create or replace function public.fn_smart_entry_update(p_id uuid, p_payload jsonb)
returns smart_entries language plpgsql security definer set search_path to 'public' as $function$
declare v_row smart_entries;
begin
  select * into v_row from smart_entries where id = p_id and business_id = fn_current_business_id() for update;
  if not found then raise exception 'entry not found'; end if;
  if v_row.status not in ('draft','rejected','failed') then
    raise exception 'only draft, rejected or failed entries can be edited';
  end if;
  if v_row.created_by <> auth.uid() and not fn_has_permission('settings.manage') then
    raise exception 'permission denied: you can only edit your own entries';
  end if;
  update smart_entries set payload = coalesce(p_payload, payload), status = 'draft',
    validation_errors = '{}'::jsonb, decision_reason = null, rejected_by = null, rejected_at = null, updated_at = now()
  where id = p_id
  returning * into v_row;
  return v_row;
end;
$function$;
grant execute on function public.fn_smart_entry_update(uuid, jsonb) to authenticated;

-- ---------- 10. Submit (validate -> post immediately or route to pending approval) ----------
create or replace function public.fn_smart_entry_submit(p_id uuid)
returns smart_entries language plpgsql security definer set search_path to 'public' as $function$
declare
  v_row smart_entries;
  v_check jsonb;
  v_rule boolean;
  v_needs_approval boolean;
begin
  select * into v_row from smart_entries where id = p_id and business_id = fn_current_business_id() for update;
  if not found then raise exception 'entry not found'; end if;
  if v_row.status = 'approved' then raise exception 'this entry is already approved'; end if;
  if v_row.status = 'pending_approval' then return v_row; end if;
  if v_row.created_by <> auth.uid() and not fn_has_permission('settings.manage') then
    raise exception 'permission denied: you can only submit your own entries';
  end if;

  v_check := fn_validate_smart_entry(v_row.entry_type, v_row.payload);

  if v_check->'errors' <> '{}'::jsonb then
    update smart_entries set status = 'failed', validation_errors = v_check->'errors', warnings = coalesce(v_check->'warnings','[]'::jsonb), submitted_at = now(), updated_at = now()
    where id = p_id returning * into v_row;
    return v_row;
  end if;

  select requires_approval into v_rule from smart_entry_approval_rules where business_id = v_row.business_id and entry_type = v_row.entry_type;
  v_needs_approval := coalesce(v_rule,false) or coalesce((v_check->>'force_approval')::boolean, false);

  update smart_entries set validation_errors = '{}'::jsonb, warnings = coalesce(v_check->'warnings','[]'::jsonb), submitted_at = now(), updated_at = now()
  where id = p_id;

  if v_needs_approval then
    update smart_entries set status = 'pending_approval' where id = p_id returning * into v_row;
    return v_row;
  end if;

  perform fn_post_smart_entry(p_id, auth.uid());
  select * into v_row from smart_entries where id = p_id;
  return v_row;
end;
$function$;
grant execute on function public.fn_smart_entry_submit(uuid) to authenticated;

-- ---------- 11. Approve ----------
create or replace function public.fn_smart_entry_approve(p_id uuid)
returns smart_entries language plpgsql security definer set search_path to 'public' as $function$
declare v_row smart_entries;
begin
  if not fn_has_permission('smart_entry.approve') then
    raise exception 'permission denied: smart_entry.approve required';
  end if;
  select * into v_row from smart_entries where id = p_id and business_id = fn_current_business_id() for update;
  if not found then raise exception 'entry not found'; end if;
  if v_row.status <> 'pending_approval' then
    return v_row;
  end if;
  perform fn_post_smart_entry(p_id, auth.uid());
  select * into v_row from smart_entries where id = p_id;
  return v_row;
end;
$function$;
grant execute on function public.fn_smart_entry_approve(uuid) to authenticated;

-- ---------- 12. Reject ----------
create or replace function public.fn_smart_entry_reject(p_id uuid, p_reason text)
returns smart_entries language plpgsql security definer set search_path to 'public' as $function$
declare v_row smart_entries;
begin
  if not fn_has_permission('smart_entry.approve') then
    raise exception 'permission denied: smart_entry.approve required';
  end if;
  if coalesce(btrim(p_reason),'') = '' then
    raise exception 'a reason is required to reject an entry';
  end if;
  update smart_entries set status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), decision_reason = p_reason, updated_at = now()
  where id = p_id and business_id = fn_current_business_id() and status = 'pending_approval'
  returning * into v_row;
  if not found then raise exception 'entry not found or not pending approval'; end if;
  insert into audit_logs (user_id, action, module, record_id, new_value) values (auth.uid(),'REJECT','smart_entries', p_id, jsonb_build_object('reason', p_reason));
  return v_row;
end;
$function$;
grant execute on function public.fn_smart_entry_reject(uuid, text) to authenticated;

-- ---------- 13. Delete (unposted only) with reason ----------
create or replace function public.fn_smart_entry_delete(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_row smart_entries;
begin
  select * into v_row from smart_entries where id = p_id and business_id = fn_current_business_id() for update;
  if not found then raise exception 'entry not found'; end if;
  if v_row.status = 'approved' then
    raise exception 'approved entries cannot be deleted — use reverse instead';
  end if;
  if v_row.created_by <> auth.uid() and not fn_has_permission('settings.manage') then
    raise exception 'permission denied: you can only delete your own entries';
  end if;
  if v_row.status = 'rejected' and coalesce(btrim(p_reason),'') = '' then
    raise exception 'a reason is required to delete a rejected entry';
  end if;
  delete from smart_entries where id = p_id;
  insert into audit_logs (user_id, action, module, record_id, new_value) values (auth.uid(),'DELETE','smart_entries', p_id, jsonb_build_object('reason', p_reason, 'entry_type', v_row.entry_type));
end;
$function$;
grant execute on function public.fn_smart_entry_delete(uuid, text) to authenticated;

-- ---------- 14. Reverse an approved entry (Owner only), for types with an existing void RPC ----------
create or replace function public.fn_smart_entry_reverse(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_row smart_entries;
begin
  if not fn_has_permission('settings.manage') then
    raise exception 'permission denied: only the Owner can reverse an approved entry';
  end if;
  if coalesce(btrim(p_reason),'') = '' then
    raise exception 'a reason is required to reverse an approved entry';
  end if;
  select * into v_row from smart_entries where id = p_id and business_id = fn_current_business_id();
  if not found then raise exception 'entry not found'; end if;
  if v_row.status <> 'approved' then raise exception 'only approved entries can be reversed'; end if;

  if v_row.linked_record_type = 'delivery' then
    perform fn_void_delivery(v_row.linked_record_id, p_reason);
  elsif v_row.linked_record_type = 'payment' then
    perform fn_void_payment(v_row.linked_record_id, p_reason);
  elsif v_row.linked_record_type = 'expense' then
    perform fn_void_expense(v_row.linked_record_id, p_reason);
  elsif v_row.linked_record_type = 'invoice' then
    perform fn_void_invoice(v_row.linked_record_id, p_reason);
  else
    raise exception 'reversal is not supported yet for % entries — void/adjust the underlying record directly', v_row.entry_type;
  end if;

  update smart_entries set decision_reason = coalesce(decision_reason,'') || E'\n[REVERSED] ' || p_reason, updated_at = now() where id = p_id;
  insert into audit_logs (user_id, action, module, record_id, new_value) values (auth.uid(),'REVERSE','smart_entries', p_id, jsonb_build_object('reason', p_reason));
end;
$function$;
grant execute on function public.fn_smart_entry_reverse(uuid, text) to authenticated;

-- ---------- 15. The poster — internal only, no grant to authenticated (mirrors post_journal) ----------
create or replace function public.fn_post_smart_entry(p_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_row smart_entries;
  p jsonb;
  v_customer_id uuid;
  v_product_id uuid;
  v_qty numeric; v_empty numeric; v_rate numeric; v_amount numeric;
  v_delivery_id uuid; v_delivery_no text;
  v_receipt_no text;
  v_expense_id uuid; v_expense_no text;
  v_invoice_id uuid; v_invoice_no text;
  v_purchase_id uuid; v_purchase_no text; v_supplier_id uuid; v_item jsonb;
  v_category_id uuid;
  v_salary_id uuid;
  v_net numeric;
  v_kind text;
  v_to_state bottle_state; v_from_state bottle_state;
  v_subtotal numeric; v_net_amount numeric;
  v_new_id uuid;
begin
  select * into v_row from smart_entries where id = p_id for update;
  if not found then raise exception 'entry not found'; end if;
  p := v_row.payload;

  if v_row.entry_type = 'customer' then
    insert into customers (business_id, code, name, business_name, mobile, whatsapp_number, address, zone_id,
        customer_type, opening_balance, credit_limit, regular_qty, payment_terms, notes, status, created_by)
    values (v_row.business_id, fn_next_customer_code(), p->>'name', nullif(p->>'business_name',''), p->>'mobile',
        nullif(p->>'whatsapp_number',''), nullif(p->>'address',''), nullif(p->>'zone_id','')::uuid,
        coalesce(nullif(p->>'customer_type',''),'residential'), coalesce((p->>'opening_balance')::numeric,0),
        coalesce((p->>'credit_limit')::numeric,0), coalesce((p->>'regular_qty')::numeric,0),
        nullif(p->>'payment_terms',''), nullif(p->>'notes',''), 'active', p_actor)
    returning id into v_customer_id;
    if nullif(p->>'product_id','') is not null and coalesce((p->>'rate')::numeric,0) > 0 then
      insert into customer_prices (customer_id, product_id, price, effective_from, created_by)
      values (v_customer_id, (p->>'product_id')::uuid, (p->>'rate')::numeric, current_date, p_actor);
    end if;
    update smart_entries set linked_record_type='customer', linked_record_id=v_customer_id where id=p_id;

  elsif v_row.entry_type = 'delivery' then
    v_customer_id := (p->>'customer_id')::uuid;
    v_product_id := (p->>'product_id')::uuid;
    v_qty := (p->>'delivered_qty')::numeric;
    v_empty := coalesce((p->>'empty_received')::numeric,0);
    v_rate := coalesce(nullif(p->>'unit_price','')::numeric, fn_resolve_product_rate(v_customer_id, v_product_id, coalesce(nullif(p->>'delivery_date','')::date, current_date)), 0);
    v_amount := v_qty * v_rate;
    v_delivery_no := fn_next_delivery_no();

    insert into deliveries (business_id, delivery_no, customer_id, rider_id, delivery_date, status, amount, amount_collected, payment_method, created_by)
    values (v_row.business_id, v_delivery_no, v_customer_id, nullif(p->>'rider_id','')::uuid,
        coalesce(nullif(p->>'delivery_date','')::date, current_date), 'delivered', v_amount,
        coalesce((p->>'amount_collected')::numeric,0), nullif(p->>'payment_method','')::payment_method, p_actor)
    returning id into v_delivery_id;

    insert into delivery_items (delivery_id, product_id, expected_qty, delivered_qty, returned_qty, unit_price)
    values (v_delivery_id, v_product_id, v_qty, v_qty, v_empty, v_rate);

    insert into bottle_transactions (txn_date, product_id, quantity, from_state, to_state, customer_id, rider_id, reference_type, reference_id, created_by)
    values (coalesce(nullif(p->>'delivery_date','')::date, current_date), v_product_id, v_qty, 'with_rider', 'with_customer', v_customer_id, nullif(p->>'rider_id','')::uuid, 'delivery', v_delivery_id, p_actor);
    if v_empty > 0 then
      insert into bottle_transactions (txn_date, product_id, quantity, from_state, to_state, customer_id, rider_id, reference_type, reference_id, created_by)
      values (coalesce(nullif(p->>'delivery_date','')::date, current_date), v_product_id, v_empty, 'with_customer', 'with_rider', v_customer_id, nullif(p->>'rider_id','')::uuid, 'delivery_return', v_delivery_id, p_actor);
    end if;

    if v_amount > 0 then
      insert into customer_ledger_entries (customer_id, entry_date, reference_type, reference_id, description, debit, credit, created_by, smart_entry_id, bottles_out, bottles_in)
      values (v_customer_id, coalesce(nullif(p->>'delivery_date','')::date, current_date), 'delivery', v_delivery_id, 'Delivery ' || v_delivery_no, v_amount, 0, p_actor, p_id, v_qty::int, v_empty::int);
    end if;

    if coalesce((p->>'amount_collected')::numeric,0) > 0 then
      v_receipt_no := fn_next_receipt_no();
      insert into payments (receipt_no, customer_id, amount, payment_date, method, cash_account_id, reference, received_by, notes)
      values (v_receipt_no, v_customer_id, (p->>'amount_collected')::numeric, coalesce(nullif(p->>'delivery_date','')::date, current_date),
        coalesce(nullif(p->>'payment_method',''),'cash')::payment_method, nullif(p->>'cash_account_id','')::uuid, v_delivery_no, coalesce(nullif(p->>'rider_id','')::uuid, p_actor),
        'Collected on delivery ' || v_delivery_no);
    end if;
    update smart_entries set linked_record_type='delivery', linked_record_id=v_delivery_id where id=p_id;

  elsif v_row.entry_type = 'payment' then
    v_receipt_no := fn_next_receipt_no();
    insert into payments (receipt_no, customer_id, amount, payment_date, method, cash_account_id, reference, received_by, notes)
    values (v_receipt_no, (p->>'customer_id')::uuid, (p->>'amount')::numeric, coalesce(nullif(p->>'payment_date','')::date, current_date),
      (p->>'method')::payment_method, nullif(p->>'cash_account_id','')::uuid, nullif(p->>'reference',''), p_actor, nullif(p->>'notes',''))
    returning id into v_new_id;
    update customer_ledger_entries set smart_entry_id = p_id where reference_type='payment' and reference_id = v_new_id;
    update smart_entries set linked_record_type='payment', linked_record_id=v_new_id where id=p_id;

  elsif v_row.entry_type = 'expense' then
    v_expense_no := fn_next_expense_no();
    insert into expenses (expense_no, category_id, description, amount, expense_date, payment_method, cash_account_id,
        employee_id, zone_id, vehicle_id, receipt_url, receipt_reference, status, submitted_by, approved_by, approved_at, created_by)
    values (v_expense_no, (p->>'category_id')::uuid, nullif(p->>'description',''), (p->>'amount')::numeric,
        coalesce(nullif(p->>'expense_date','')::date, current_date), coalesce(nullif(p->>'payment_method',''),'cash')::payment_method,
        nullif(p->>'cash_account_id','')::uuid, nullif(p->>'employee_id','')::uuid, nullif(p->>'zone_id','')::uuid,
        nullif(p->>'vehicle_id','')::uuid, nullif(p->>'receipt_url',''), nullif(p->>'receipt_reference',''),
        'approved', v_row.created_by, p_actor, now(), v_row.created_by)
    returning id into v_expense_id;
    update smart_entries set linked_record_type='expense', linked_record_id=v_expense_id where id=p_id;

  elsif v_row.entry_type = 'bottle' then
    v_customer_id := (p->>'customer_id')::uuid;
    v_product_id := (p->>'product_id')::uuid;
    if coalesce((p->>'delivered_qty')::numeric,0) > 0 then
      insert into bottle_transactions (txn_date, product_id, quantity, from_state, to_state, customer_id, reference_type, remarks, created_by)
      values (coalesce(nullif(p->>'txn_date','')::date,current_date), v_product_id, (p->>'delivered_qty')::numeric, 'warehouse','with_customer', v_customer_id, 'bottle_issue', nullif(p->>'remarks',''), p_actor);
    end if;
    if coalesce((p->>'returned_qty')::numeric,0) > 0 then
      insert into bottle_transactions (txn_date, product_id, quantity, from_state, to_state, customer_id, reference_type, remarks, created_by)
      values (coalesce(nullif(p->>'txn_date','')::date,current_date), v_product_id, (p->>'returned_qty')::numeric, 'with_customer','warehouse', v_customer_id, 'bottle_return', nullif(p->>'remarks',''), p_actor);
    end if;
    if coalesce((p->>'damaged_qty')::numeric,0) > 0 then
      insert into bottle_transactions (txn_date, product_id, quantity, from_state, to_state, customer_id, reference_type, remarks, created_by)
      values (coalesce(nullif(p->>'txn_date','')::date,current_date), v_product_id, (p->>'damaged_qty')::numeric, 'with_customer','damaged', v_customer_id, 'bottle_damaged', nullif(p->>'remarks',''), p_actor);
    end if;
    if coalesce((p->>'lost_qty')::numeric,0) > 0 then
      insert into bottle_transactions (txn_date, product_id, quantity, from_state, to_state, customer_id, reference_type, remarks, created_by)
      values (coalesce(nullif(p->>'txn_date','')::date,current_date), v_product_id, (p->>'lost_qty')::numeric, 'with_customer','lost', v_customer_id, 'bottle_lost', nullif(p->>'remarks',''), p_actor);
    end if;
    if (p->>'adjustment_qty') is not null and (p->>'adjustment_qty')::numeric <> 0 then
      if (p->>'adjustment_qty')::numeric > 0 then
        v_from_state := 'warehouse'; v_to_state := 'with_customer';
      else
        v_from_state := 'with_customer'; v_to_state := 'adjustment';
      end if;
      insert into bottle_transactions (txn_date, product_id, quantity, from_state, to_state, customer_id, reference_type, remarks, created_by)
      values (coalesce(nullif(p->>'txn_date','')::date,current_date), v_product_id, abs((p->>'adjustment_qty')::numeric), v_from_state, v_to_state, v_customer_id, 'bottle_adjustment', p->>'adjustment_reason', p_actor);
    end if;
    update smart_entries set linked_record_type='bottle', linked_record_id=null where id=p_id;

  elsif v_row.entry_type = 'inventory_purchase' then
    v_supplier_id := nullif(p->>'supplier_id','')::uuid;
    if v_supplier_id is null and coalesce(btrim(p->>'supplier_name'),'') <> '' then
      select id into v_supplier_id from suppliers where business_id = v_row.business_id and name = btrim(p->>'supplier_name');
      if v_supplier_id is null then
        insert into suppliers (name) values (btrim(p->>'supplier_name')) returning id into v_supplier_id;
      end if;
    end if;
    v_purchase_no := fn_next_purchase_no();
    insert into purchases (purchase_no, supplier_id, purchase_date, status, notes, created_by)
    values (v_purchase_no, v_supplier_id, coalesce(nullif(p->>'purchase_date','')::date,current_date), 'received', nullif(p->>'notes',''), p_actor)
    returning id into v_purchase_id;
    for v_item in select * from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
      insert into purchase_items (purchase_id, inventory_item_id, product_id, quantity, rate, discount)
      values (v_purchase_id, nullif(v_item->>'inventory_item_id','')::uuid, nullif(v_item->>'product_id','')::uuid,
        (v_item->>'quantity')::numeric, (v_item->>'rate')::numeric, coalesce((v_item->>'discount')::numeric,0));
      if nullif(v_item->>'inventory_item_id','') is not null then
        insert into inventory_movements (item_id, movement_type, quantity, unit_cost, reference_type, reference_id, created_by)
        values ((v_item->>'inventory_item_id')::uuid, 'purchase', (v_item->>'quantity')::numeric, (v_item->>'rate')::numeric, 'purchase', v_purchase_id, p_actor);
      end if;
    end loop;
    update smart_entries set linked_record_type='purchase', linked_record_id=v_purchase_id where id=p_id;

  elsif v_row.entry_type = 'employee_salary' then
    v_net := (p->>'net_paid')::numeric;
    insert into employee_salary_records (employee_id, period_month, base_salary, advances, deductions, net_paid, paid_date, notes, created_by)
    values ((p->>'employee_id')::uuid, (p->>'period_month')::date, coalesce((p->>'base_salary')::numeric,0),
      coalesce((p->>'advances')::numeric,0), coalesce((p->>'deductions')::numeric,0), v_net,
      coalesce(nullif(p->>'paid_date','')::date, current_date), nullif(p->>'notes',''), p_actor)
    returning id into v_salary_id;

    select id into v_category_id from expense_categories where business_id = v_row.business_id and name = 'Salaries';
    if v_category_id is not null then
      v_expense_no := fn_next_expense_no();
      insert into expenses (expense_no, category_id, description, amount, expense_date, payment_method, cash_account_id,
          employee_id, status, submitted_by, approved_by, approved_at, created_by)
      values (v_expense_no, v_category_id, 'Salary — ' || to_char((p->>'period_month')::date,'Mon YYYY'), v_net,
          coalesce(nullif(p->>'paid_date','')::date, current_date), coalesce(nullif(p->>'payment_method',''),'cash')::payment_method,
          nullif(p->>'cash_account_id','')::uuid, (p->>'employee_id')::uuid, 'approved', v_row.created_by, p_actor, now(), v_row.created_by);
    end if;
    update smart_entries set linked_record_type='employee_salary', linked_record_id=v_salary_id where id=p_id;

  elsif v_row.entry_type = 'invoice_adjustment' then
    v_invoice_no := fn_next_invoice_no();
    v_subtotal := 0;
    for v_item in select * from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
      v_subtotal := v_subtotal + (coalesce((v_item->>'quantity')::numeric,0) * coalesce((v_item->>'rate')::numeric,0) - coalesce((v_item->>'discount')::numeric,0));
    end loop;
    if coalesce(p->>'adjustment_type','invoice') = 'credit_note' then
      v_subtotal := -abs(v_subtotal);
    end if;
    v_net_amount := v_subtotal - coalesce((p->>'discount')::numeric,0) + coalesce((p->>'tax')::numeric,0);
    insert into invoices (invoice_no, customer_id, invoice_date, due_date, subtotal, discount, tax, net_amount, status, created_by)
    values (v_invoice_no, (p->>'customer_id')::uuid, coalesce(nullif(p->>'invoice_date','')::date,current_date),
      nullif(p->>'due_date','')::date, v_subtotal, coalesce((p->>'discount')::numeric,0), coalesce((p->>'tax')::numeric,0),
      v_net_amount, 'sent', p_actor)
    returning id into v_invoice_id;
    for v_item in select * from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
      insert into invoice_items (invoice_id, product_id, description, quantity, rate, discount)
      values (v_invoice_id, nullif(v_item->>'product_id','')::uuid, coalesce(v_item->>'description','Item'),
        coalesce((v_item->>'quantity')::numeric,1), coalesce((v_item->>'rate')::numeric,0), coalesce((v_item->>'discount')::numeric,0));
    end loop;
    update customer_ledger_entries set smart_entry_id = p_id where reference_type='invoice' and reference_id = v_invoice_id;
    update smart_entries set linked_record_type='invoice', linked_record_id=v_invoice_id where id=p_id;

  elsif v_row.entry_type = 'complaint_feedback' then
    v_kind := coalesce(p->>'kind','complaint');
    if v_kind = 'complaint' then
      insert into customer_complaints (customer_id, subject, description, status, created_by)
      values ((p->>'customer_id')::uuid, p->>'subject', nullif(p->>'description',''), 'open', p_actor)
      returning id into v_new_id;
      update smart_entries set linked_record_type='complaint', linked_record_id=v_new_id where id=p_id;
    else
      insert into customer_feedback (business_id, customer_id, delivery_id, overall_rating, delivery_rating, product_rating, timeliness_rating, comment)
      values (v_row.business_id, (p->>'customer_id')::uuid, nullif(p->>'delivery_id','')::uuid, (p->>'overall_rating')::int,
        nullif(p->>'delivery_rating','')::int, nullif(p->>'product_rating','')::int, nullif(p->>'timeliness_rating','')::int, nullif(p->>'comment',''))
      returning id into v_new_id;
      update smart_entries set linked_record_type='feedback', linked_record_id=v_new_id where id=p_id;
    end if;
  end if;

  update smart_entries set status = 'approved', approved_by = p_actor, approved_at = now(), updated_at = now() where id = p_id;
  insert into audit_logs (user_id, action, module, record_id, new_value)
  values (p_actor, 'APPROVE', 'smart_entries', p_id, jsonb_build_object('entry_type', v_row.entry_type));
end;
$function$;
