-- ============================================================
-- EVERGREEN PLUS WATER — MIGRATION 0002: ACCOUNTING + FLEET + NOTIFICATIONS
-- Run this AFTER 0001_init.sql in Supabase SQL Editor
-- ============================================================

do $$ begin
  create type account_type as enum ('ASSET','LIABILITY','EQUITY','INCOME','COGS','EXPENSE');
exception when duplicate_object then null; end $$;

-- ---------- CHART OF ACCOUNTS ----------
create table if not exists chart_of_accounts (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  type account_type not null,
  is_system boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- JOURNAL ENTRIES (double-entry) ----------
create table if not exists journal_entries (
  id uuid primary key default uuid_generate_v4(),
  entry_date date not null default current_date,
  reference text,
  description text,
  source_module text,
  source_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_journal_date on journal_entries(entry_date);
create index if not exists idx_journal_source on journal_entries(source_module, source_id);

create table if not exists journal_lines (
  id uuid primary key default uuid_generate_v4(),
  journal_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references chart_of_accounts(id),
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  check (debit >= 0 and credit >= 0),
  check (not (debit > 0 and credit > 0))
);
create index if not exists idx_journal_lines_account on journal_lines(account_id);
create index if not exists idx_journal_lines_journal on journal_lines(journal_id);

create or replace function fn_check_journal_balanced() returns trigger as $$
declare
  jid uuid;
  total_debit numeric; total_credit numeric;
begin
  jid := coalesce(new.journal_id, old.journal_id);
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into total_debit, total_credit
    from journal_lines where journal_id = jid;
  if round(total_debit,2) <> round(total_credit,2) then
    raise exception 'Journal entry % is not balanced: debit % <> credit %', jid, total_debit, total_credit;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_journal_balance_check on journal_lines;
create constraint trigger trg_journal_balance_check
  after insert or update or delete on journal_lines
  deferrable initially deferred
  for each row execute function fn_check_journal_balanced();

create or replace function post_journal(
  p_date date, p_reference text, p_description text,
  p_source_module text, p_source_id uuid, p_created_by uuid, p_lines jsonb
) returns uuid as $$
declare
  jid uuid;
  ln jsonb;
  acc_id uuid;
begin
  insert into journal_entries (entry_date, reference, description, source_module, source_id, created_by)
    values (p_date, p_reference, p_description, p_source_module, p_source_id, p_created_by)
    returning id into jid;

  for ln in select * from jsonb_array_elements(p_lines) loop
    select id into acc_id from chart_of_accounts where name = (ln->>'account') limit 1;
    if acc_id is null then
      raise exception 'Unknown account: %', ln->>'account';
    end if;
    insert into journal_lines (journal_id, account_id, debit, credit)
      values (jid, acc_id, coalesce((ln->>'debit')::numeric,0), coalesce((ln->>'credit')::numeric,0));
  end loop;

  return jid;
end;
$$ language plpgsql security definer;

-- ---------- DAILY CLOSING ----------
create table if not exists daily_closings (
  id uuid primary key default uuid_generate_v4(),
  close_date date not null unique,
  opening_cash numeric(14,2) not null default 0,
  sales_total numeric(14,2) not null default 0,
  collections_total numeric(14,2) not null default 0,
  expenses_total numeric(14,2) not null default 0,
  expected_cash numeric(14,2) not null default 0,
  actual_cash numeric(14,2),
  difference numeric(14,2),
  status text not null default 'Open',
  closed_by uuid references profiles(id),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- FLEET ----------
create table if not exists vehicles (
  id uuid primary key default uuid_generate_v4(),
  vehicle_no text not null unique,
  vehicle_type text,
  driver_employee_id uuid references employees(id),
  mileage int default 0,
  registration_date date,
  insurance_expiry date,
  status text not null default 'Active',
  created_at timestamptz not null default now()
);
create table if not exists vehicle_expenses (
  id uuid primary key default uuid_generate_v4(),
  vehicle_id uuid not null references vehicles(id),
  category text not null,
  amount numeric(12,2) not null,
  exp_date date not null default current_date,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_vehicle_expenses_vehicle on vehicle_expenses(vehicle_id);

-- ---------- NOTIFICATIONS ----------
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  target_role user_role,
  type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROLE ENUM UPGRADE
-- ============================================================
alter type user_role add value if not exists 'sales_executive';
alter type user_role add value if not exists 'warehouse_staff';

-- ============================================================
-- AUTO-POST JOURNAL ENTRIES (extends 0001 triggers)
-- ============================================================
create or replace function fn_sale_after_insert() returns trigger as $$
declare lines jsonb;
begin
  update customers
    set balance = balance + (new.total - new.paid),
        bottles_delivered = bottles_delivered + new.qty,
        updated_at = now()
    where id = new.customer_id;

  insert into bottle_movements (customer_id, movement_type, qty, reference_id)
    values (new.customer_id, 'DELIVERED', new.qty, new.id);

  lines := '[]'::jsonb;
  if new.paid > 0 then
    lines := lines || jsonb_build_array(jsonb_build_object('account','Cash','debit',new.paid,'credit',0));
  end if;
  if (new.total - new.paid) > 0 then
    lines := lines || jsonb_build_array(jsonb_build_object('account','Accounts Receivable','debit',new.total - new.paid,'credit',0));
  end if;
  lines := lines || jsonb_build_array(jsonb_build_object('account','Water Sales','debit',0,'credit',new.total));
  perform post_journal(new.sale_date, new.invoice_no, 'Sale to customer', 'sales', new.id, new.created_by, lines);

  insert into audit_logs (user_id, action, module, record_id, new_value)
    values (new.created_by, 'CREATE', 'sales', new.id, to_jsonb(new));
  return new;
end;
$$ language plpgsql security definer;

create or replace function fn_payment_after_insert() returns trigger as $$
declare lines jsonb;
begin
  update customers set balance = greatest(0, balance - new.amount), updated_at = now()
    where id = new.customer_id;

  lines := jsonb_build_array(
    jsonb_build_object('account', case when new.method = 'Cash' then 'Cash' else 'Bank' end, 'debit', new.amount, 'credit', 0),
    jsonb_build_object('account','Accounts Receivable','debit',0,'credit',new.amount)
  );
  perform post_journal(new.pay_date, 'PAY-' || left(new.id::text,8), 'Payment received', 'payments', new.id, new.created_by, lines);

  insert into audit_logs (user_id, action, module, record_id, new_value)
    values (new.created_by, 'CREATE', 'payments', new.id, to_jsonb(new));
  return new;
end;
$$ language plpgsql security definer;

create or replace function expense_account_for(cat text) returns text as $$
  select case cat
    when 'Fuel' then 'Fuel'
    when 'Labour' then 'Labour'
    when 'Salaries' then 'Salaries'
    when 'Maintenance' then 'Vehicle Maintenance'
    when 'Electricity' then 'Electricity'
    when 'Rent' then 'Rent'
    when 'Marketing' then 'Marketing'
    when 'Repairs' then 'Repairs'
    when 'Filling' then 'Filling Cost'
    when 'Caps' then 'Packaging Cost'
    when 'Packaging' then 'Packaging Cost'
    else 'Other Expenses'
  end;
$$ language sql immutable;

create or replace function fn_expense_after_insert() returns trigger as $$
declare lines jsonb; acct text;
begin
  acct := expense_account_for(new.category);
  lines := jsonb_build_array(
    jsonb_build_object('account', acct, 'debit', new.amount, 'credit', 0),
    jsonb_build_object('account', case when new.method = 'Cash' then 'Cash' else 'Bank' end, 'debit', 0, 'credit', new.amount)
  );
  perform post_journal(new.exp_date, 'EXP-' || left(new.id::text,8), new.description, 'expenses', new.id, new.created_by, lines);
  insert into audit_logs (user_id, action, module, record_id, new_value)
    values (new.created_by, 'CREATE', 'expenses', new.id, to_jsonb(new));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_expense_after_insert on expenses;
create trigger trg_expense_after_insert after insert on expenses
  for each row execute function fn_expense_after_insert();

-- ============================================================
-- RLS
-- ============================================================
alter table chart_of_accounts enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
alter table daily_closings enable row level security;
alter table vehicles enable row level security;
alter table vehicle_expenses enable row level security;
alter table notifications enable row level security;

drop policy if exists p_coa_select on chart_of_accounts;
create policy p_coa_select on chart_of_accounts for select using (my_role() in ('owner','manager','accountant'));
drop policy if exists p_coa_write on chart_of_accounts;
create policy p_coa_write on chart_of_accounts for all using (my_role() = 'owner');

drop policy if exists p_journal_select on journal_entries;
create policy p_journal_select on journal_entries for select using (my_role() in ('owner','accountant'));
drop policy if exists p_journal_lines_select on journal_lines;
create policy p_journal_lines_select on journal_lines for select using (my_role() in ('owner','accountant'));

drop policy if exists p_closing_select on daily_closings;
create policy p_closing_select on daily_closings for select using (my_role() in ('owner','manager','accountant'));
drop policy if exists p_closing_write on daily_closings;
create policy p_closing_write on daily_closings for all using (my_role() in ('owner','accountant'));

drop policy if exists p_vehicles_select on vehicles;
create policy p_vehicles_select on vehicles for select using (my_role() in ('owner','manager'));
drop policy if exists p_vehicles_write on vehicles;
create policy p_vehicles_write on vehicles for all using (my_role() in ('owner','manager'));
drop policy if exists p_vehexp_select on vehicle_expenses;
create policy p_vehexp_select on vehicle_expenses for select using (my_role() in ('owner','manager'));
drop policy if exists p_vehexp_write on vehicle_expenses;
create policy p_vehexp_write on vehicle_expenses for all using (my_role() in ('owner','manager'));

drop policy if exists p_notif_select on notifications;
create policy p_notif_select on notifications for select using (my_role() = 'owner' or target_role = my_role());
drop policy if exists p_notif_update on notifications;
create policy p_notif_update on notifications for update using (my_role() = 'owner' or target_role = my_role());

-- ============================================================
-- SEED: default Chart of Accounts
-- ============================================================
insert into chart_of_accounts (code, name, type, is_system) values
  ('1000','Cash','ASSET',true),
  ('1010','Bank','ASSET',true),
  ('1100','Accounts Receivable','ASSET',true),
  ('1200','Inventory','ASSET',true),
  ('1300','Water Bottles / Containers','ASSET',true),
  ('1400','Vehicle Assets','ASSET',true),
  ('1900','Other Assets','ASSET',false),
  ('2000','Accounts Payable','LIABILITY',true),
  ('2100','Customer Bottle Deposit Liability','LIABILITY',true),
  ('2200','Loans','LIABILITY',false),
  ('2900','Other Liabilities','LIABILITY',false),
  ('3000','Owner Capital','EQUITY',true),
  ('3100','Retained Earnings','EQUITY',true),
  ('3200','Drawings','EQUITY',true),
  ('4000','Water Sales','INCOME',true),
  ('4100','Other Sales','INCOME',false),
  ('5000','Water/Product Cost','COGS',true),
  ('5100','Filling Cost','COGS',true),
  ('5200','Packaging Cost','COGS',true),
  ('6000','Fuel','EXPENSE',true),
  ('6100','Labour','EXPENSE',true),
  ('6200','Salaries','EXPENSE',true),
  ('6300','Vehicle Maintenance','EXPENSE',true),
  ('6400','Electricity','EXPENSE',true),
  ('6500','Rent','EXPENSE',true),
  ('6600','Marketing','EXPENSE',true),
  ('6700','Repairs','EXPENSE',true),
  ('6900','Other Expenses','EXPENSE',true)
on conflict (code) do nothing;
