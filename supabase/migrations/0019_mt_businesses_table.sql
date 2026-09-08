-- Multi-tenant foundation, step 1 of N: the tenant table itself, seeded
-- with the existing business. Purely additive — one new table, one row.
-- Nothing existing is touched. Helper functions and RLS come in later
-- steps, once profiles.business_id exists (they reference it).
create table if not exists businesses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  logo_url text,
  phone text,
  email text,
  address text,
  city text,
  currency text not null default 'PKR',
  timezone text not null default 'Asia/Karachi',
  subscription_plan text not null default 'starter',
  subscription_status text not null default 'active',
  trial_start date,
  trial_end date,
  created_at timestamptz not null default now()
);

alter table businesses enable row level security;

insert into businesses (name, currency, timezone, subscription_plan, subscription_status)
  select 'Evergreen Water', 'PKR', 'Asia/Karachi', 'starter', 'active'
  where not exists (select 1 from businesses where name = 'Evergreen Water');
