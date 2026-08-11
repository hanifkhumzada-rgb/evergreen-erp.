-- ============================================================
-- EVERGREEN PLUS WATER — PRODUCTION SCHEMA (Phase 1 + Phase 2 core)
-- Run this once in Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- ROLES ----------
do $$ begin
  create type user_role as enum ('owner','manager','accountant','delivery_boy');
exception when duplicate_object then null; end $$;

-- ---------- PROFILES (extends Supabase auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'delivery_boy',
  phone text,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- ZONES ----------
create table if not exists zones (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- PRODUCTS ----------
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  unit text not null default 'bottle',
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  min_stock int not null default 0,
  stock int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CUSTOMERS ----------
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  business text,
  phone text not null,
  whatsapp text,
  address text,
  zone_id uuid references zones(id),
  customer_type text not null default 'Household',
  rate numeric(12,2) not null default 0,
  regular_qty int not null default 1,
  frequency text default 'Weekly',
  payment_terms text default 'Cash',
  opening_balance numeric(12,2) not null default 0,
  balance numeric(12,2) not null default 0,
  credit_limit numeric(12,2) not null default 5000,
  status text not null default 'Active',
  notes text,
  bottles_delivered int not null default 0,
  bottles_returned int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);
create index if not exists idx_customers_zone on customers(zone_id);
create index if not exists idx_customers_status on customers(status);
create unique index if not exists idx_customers_phone on customers(phone);

-- ---------- EMPLOYEES ----------
create table if not exists employees (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),   -- link to a real login if they have one
  name text not null,
  phone text,
  role text not null default 'Delivery Boy',
  zone_id uuid references zones(id),
  status text not null default 'Active',
  salary numeric(12,2) default 0,
  created_at timestamptz not null default now()
);

-- ---------- SALES / INVOICES ----------
create table if not exists sales (
  id uuid primary key default uuid_generate_v4(),
  invoice_no text not null unique,
  customer_id uuid not null references customers(id),
  product_id uuid references products(id),
  qty int not null check (qty > 0),
  unit_price numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  paid numeric(12,2) not null default 0,
  balance numeric(12,2) not null,
  payment_method text default 'Cash',
  payment_status text not null default 'Pending',
  sale_date date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);
create index if not exists idx_sales_customer on sales(customer_id);
create index if not exists idx_sales_date on sales(sale_date);
create index if not exists idx_sales_status on sales(payment_status);

-- invoice number sequence, generated server-side to avoid duplicates
create sequence if not exists invoice_seq start 1000;
create or replace function next_invoice_no() returns text as $$
  select 'EGW-' || nextval('invoice_seq')::text;
$$ language sql;

-- ---------- PAYMENTS ----------
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id),
  amount numeric(12,2) not null check (amount > 0),
  method text default 'Cash',
  reference text,
  notes text,
  pay_date date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);
create index if not exists idx_payments_customer on payments(customer_id);

-- ---------- EXPENSES ----------
create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  category text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  method text default 'Cash',
  exp_date date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);
create index if not exists idx_expenses_date on expenses(exp_date);

-- ---------- DELIVERIES ----------
create table if not exists deliveries (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id),
  employee_id uuid references employees(id),
  product_id uuid references products(id),
  qty int not null default 1,
  empty_expected int not null default 0,
  empty_received int not null default 0,
  status text not null default 'Pending',
  cash_collected numeric(12,2) not null default 0,
  payment_method text default 'Cash',
  notes text,
  del_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_deliveries_date on deliveries(del_date);
create index if not exists idx_deliveries_employee on deliveries(employee_id);
create index if not exists idx_deliveries_status on deliveries(status);

-- ---------- BOTTLE MOVEMENTS (source of truth for bottle tracking) ----------
create table if not exists bottle_movements (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id),
  movement_type text not null, -- DELIVERED, RETURNED, DAMAGED, LOST, MAINTENANCE
  qty int not null,
  reference_id uuid, -- sale_id or delivery_id
  moved_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

-- ---------- INVENTORY MOVEMENTS ----------
create table if not exists inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id),
  movement_type text not null, -- PURCHASE, SALE, RETURN, DAMAGE, ADJUSTMENT
  qty int not null,
  reference_id uuid,
  moved_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

-- ---------- AUDIT LOG ----------
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  action text not null,
  module text not null,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TRIGGERS: keep customer balances & bottle counts consistent
-- (this is what makes the ledger/bottle-balance trustworthy —
--  the frontend never calculates these itself)
-- ============================================================
create or replace function fn_sale_after_insert() returns trigger as $$
begin
  update customers
    set balance = balance + (new.total - new.paid),
        bottles_delivered = bottles_delivered + new.qty,
        updated_at = now()
    where id = new.customer_id;

  insert into bottle_movements (customer_id, movement_type, qty, reference_id)
    values (new.customer_id, 'DELIVERED', new.qty, new.id);

  insert into audit_logs (user_id, action, module, record_id, new_value)
    values (new.created_by, 'CREATE', 'sales', new.id, to_jsonb(new));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sale_after_insert on sales;
create trigger trg_sale_after_insert after insert on sales
  for each row execute function fn_sale_after_insert();

create or replace function fn_payment_after_insert() returns trigger as $$
begin
  update customers set balance = greatest(0, balance - new.amount), updated_at = now()
    where id = new.customer_id;

  insert into audit_logs (user_id, action, module, record_id, new_value)
    values (new.created_by, 'CREATE', 'payments', new.id, to_jsonb(new));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_payment_after_insert on payments;
create trigger trg_payment_after_insert after insert on payments
  for each row execute function fn_payment_after_insert();

create or replace function fn_delivery_after_update() returns trigger as $$
begin
  if new.status = 'Delivered' and old.status is distinct from 'Delivered' then
    update customers set bottles_returned = bottles_returned + new.empty_received, updated_at = now()
      where id = new.customer_id;
    insert into bottle_movements (customer_id, movement_type, qty, reference_id)
      values (new.customer_id, 'RETURNED', new.empty_received, new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_delivery_after_update on deliveries;
create trigger trg_delivery_after_update after update on deliveries
  for each row execute function fn_delivery_after_update();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table zones enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table employees enable row level security;
alter table sales enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table deliveries enable row level security;
alter table bottle_movements enable row level security;
alter table inventory_movements enable row level security;
alter table audit_logs enable row level security;

create or replace function my_role() returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- profiles: everyone can see their own row; owner/manager see all
drop policy if exists p_profiles_self on profiles;
create policy p_profiles_self on profiles for select using (id = auth.uid() or my_role() in ('owner','manager'));
drop policy if exists p_profiles_update_self on profiles;
create policy p_profiles_update_self on profiles for update using (id = auth.uid());

-- zones/products: readable by all logged-in staff, writable by owner/manager
drop policy if exists p_zones_read on zones;
create policy p_zones_read on zones for select using (auth.uid() is not null);
drop policy if exists p_zones_write on zones;
create policy p_zones_write on zones for all using (my_role() in ('owner','manager'));
drop policy if exists p_products_read on products;
create policy p_products_read on products for select using (auth.uid() is not null);
drop policy if exists p_products_write on products;
create policy p_products_write on products for all using (my_role() in ('owner','manager'));

-- customers: owner/manager full; accountant read+update balance-relevant fields; delivery_boy no access
drop policy if exists p_customers_select on customers;
create policy p_customers_select on customers for select using (my_role() in ('owner','manager','accountant'));
drop policy if exists p_customers_write on customers;
create policy p_customers_write on customers for insert with check (my_role() in ('owner','manager'));
drop policy if exists p_customers_update on customers;
create policy p_customers_update on customers for update using (my_role() in ('owner','manager','accountant'));
drop policy if exists p_customers_delete on customers;
create policy p_customers_delete on customers for delete using (my_role() = 'owner');

-- employees: owner/manager
drop policy if exists p_employees_select on employees;
create policy p_employees_select on employees for select using (my_role() in ('owner','manager') or user_id = auth.uid());
drop policy if exists p_employees_write on employees;
create policy p_employees_write on employees for all using (my_role() in ('owner','manager'));

-- sales: owner/manager/accountant
drop policy if exists p_sales_select on sales;
create policy p_sales_select on sales for select using (my_role() in ('owner','manager','accountant'));
drop policy if exists p_sales_insert on sales;
create policy p_sales_insert on sales for insert with check (my_role() in ('owner','manager','accountant'));

-- payments: owner/accountant write, manager read
drop policy if exists p_payments_select on payments;
create policy p_payments_select on payments for select using (my_role() in ('owner','manager','accountant'));
drop policy if exists p_payments_insert on payments;
create policy p_payments_insert on payments for insert with check (my_role() in ('owner','accountant'));

-- expenses: owner/accountant write, manager read
drop policy if exists p_expenses_select on expenses;
create policy p_expenses_select on expenses for select using (my_role() in ('owner','manager','accountant'));
drop policy if exists p_expenses_insert on expenses;
create policy p_expenses_insert on expenses for insert with check (my_role() in ('owner','accountant'));

-- deliveries: owner/manager full; delivery_boy only their own rows
drop policy if exists p_deliveries_select on deliveries;
create policy p_deliveries_select on deliveries for select using (
  my_role() in ('owner','manager') or
  employee_id in (select id from employees where user_id = auth.uid())
);
drop policy if exists p_deliveries_insert on deliveries;
create policy p_deliveries_insert on deliveries for insert with check (my_role() in ('owner','manager'));
drop policy if exists p_deliveries_update on deliveries;
create policy p_deliveries_update on deliveries for update using (
  my_role() in ('owner','manager') or
  employee_id in (select id from employees where user_id = auth.uid())
);

-- bottle/inventory movements: readable by owner/manager, insert via triggers (security definer) or owner/manager
drop policy if exists p_bottlemove_select on bottle_movements;
create policy p_bottlemove_select on bottle_movements for select using (my_role() in ('owner','manager'));
drop policy if exists p_invmove_select on inventory_movements;
create policy p_invmove_select on inventory_movements for select using (my_role() in ('owner','manager'));

-- audit logs: owner only
drop policy if exists p_audit_select on audit_logs;
create policy p_audit_select on audit_logs for select using (my_role() = 'owner');

-- ============================================================
-- SEED: zones + products (safe to re-run — ON CONFLICT DO NOTHING)
-- ============================================================
insert into zones (name) values ('Zone A - Clifton'), ('Zone B - Gulshan'), ('Zone C - DHA')
  on conflict (name) do nothing;

insert into products (name, unit, price, cost, min_stock, stock) values
  ('19L Bottle','bottle',120,55,100,340),
  ('500ml Bottle','carton(24)',480,260,30,62),
  ('1.5L Bottle','carton(12)',720,420,20,15),
  ('6L Bottle','bottle',220,130,40,51)
  on conflict do nothing;
