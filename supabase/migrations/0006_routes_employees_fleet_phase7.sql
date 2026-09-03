-- Phase 7 — Fleet + Employees + Zones & Routes.
-- "Route" existed only as free text on customers.route with zero backing
-- entity, management page, or reporting — the single biggest gap found in
-- this audit. Adding a real routes table; customers.route (the old
-- free-text column) is left in place untouched for backward compatibility
-- with anything still reading it directly, kept in sync from route_id by
-- application code going forward.
create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  zone_id uuid references zones(id),
  assigned_rider_id uuid references profiles(id),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_routes_zone on routes(zone_id);
alter table routes enable row level security;
drop policy if exists p_routes_all on routes;
create policy p_routes_all on routes for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

alter table customers add column if not exists route_id uuid references routes(id);
create index if not exists idx_customers_route on customers(route_id);

-- Employees (profiles): fields the spec asks for that this table never
-- carried — additive, nullable, so existing signup/profile-creation flows
-- are untouched.
alter table profiles add column if not exists employee_code text;
alter table profiles add column if not exists joining_date date;
alter table profiles add column if not exists salary numeric(12,2);
alter table profiles add column if not exists zone_id uuid references zones(id);
alter table profiles add column if not exists assigned_vehicle_id uuid references vehicles(id);

create table if not exists employee_advances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id),
  amount numeric(12,2) not null,
  advance_date date not null default current_date,
  reason text,
  repaid boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_employee_advances_employee on employee_advances(employee_id);
alter table employee_advances enable row level security;
drop policy if exists p_employee_advances_all on employee_advances;
create policy p_employee_advances_all on employee_advances for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table if not exists employee_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id),
  attendance_date date not null default current_date,
  status text not null default 'present' check (status in ('present', 'absent', 'leave')),
  marked_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (employee_id, attendance_date)
);
alter table employee_attendance enable row level security;
drop policy if exists p_employee_attendance_all on employee_attendance;
create policy p_employee_attendance_all on employee_attendance for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Fleet: insurance/registration expiry weren't surfaced anywhere in the
-- live vehicles schema this app actually queries.
alter table vehicles add column if not exists insurance_expiry date;
alter table vehicles add column if not exists registration_expiry date;
