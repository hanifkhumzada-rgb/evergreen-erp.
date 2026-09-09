-- Customer Portal (Phase 4) — "My Evergreen Water". Auth is OTP-over-SMS
-- (Twilio, Phase 3), but the actual SESSION is a real Supabase Auth
-- session: on OTP verify, the server creates (or reuses) a real
-- auth.users row for the customer with a role_id pointing at the
-- existing 'customer' role (roles table already anticipated this — see
-- the .neq("roles.key", "customer") filters already defensively applied
-- across staff-facing lists) and signs them in server-side. That means
-- fn_current_role_key()/fn_current_business_id() work for a customer
-- session with ZERO changes — this migration only adds
-- fn_current_customer_id() and the RLS a customer session needs on top.

-- 1:1 with profiles (same id as the auth.users row) — holds the one
-- thing profiles doesn't: which customers row this portal login is for.
create table customer_portal_users (
  id uuid primary key references profiles(id) on delete cascade,
  customer_id uuid not null unique references customers(id) on delete cascade,
  business_id uuid not null references businesses(id),
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_customer_portal_users_customer on customer_portal_users(customer_id);

create or replace function public.fn_current_customer_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select customer_id from customer_portal_users where id = auth.uid();
$function$;

grant execute on function public.fn_current_customer_id() to authenticated;

-- OTP codes — hashed (sha256), never stored plaintext. A short-lived row
-- per send attempt; verify_otp() (below) checks the hash, expiry, and
-- attempt_count (max 5 tries per code) then marks it verified so it
-- can't be replayed.
create table customer_otp_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  customer_id uuid not null references customers(id),
  mobile text not null,
  otp_hash text not null,
  attempt_count integer not null default 0,
  verified_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_customer_otp_sessions_customer on customer_otp_sessions(customer_id, created_at desc);

-- In-portal notification feed (a bell icon inside My Evergreen Water) —
-- distinct from notification_logs (the generic external WhatsApp/SMS send
-- record every channel goes through) and from the staff `notifications`
-- table (Owner/Admin-facing). Populated alongside key portal-relevant
-- events (issue status change, feedback acknowledged, statement ready).
create table customer_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  customer_id uuid not null references customers(id),
  title text not null,
  message text not null,
  type text not null default 'info',
  is_read boolean not null default false,
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now()
);

create index idx_customer_notifications_customer on customer_notifications(customer_id, created_at desc);

-- "Report an Issue" — a customer complaint becomes a ticket, never a
-- direct edit to any financial record. Any correction that comes out of
-- resolving one goes through the normal authorized admin workflow (a
-- real delivery/payment/invoice action, with its own audit trail) — this
-- table only tracks the ticket itself.
create table customer_issues (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  customer_id uuid not null references customers(id),
  delivery_id uuid references deliveries(id),
  issue_type text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'rejected')),
  resolution_note text,
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_customer_issues_business_status on customer_issues(business_id, status, created_at desc);
create index idx_customer_issues_customer on customer_issues(customer_id, created_at desc);

-- "Give Feedback" — star ratings (1-5) + optional comment. delivery_id
-- and rider_id are both nullable: general feedback isn't tied to one
-- delivery, but delivery-boy ratings need rider_id to roll up per-rider.
create table customer_feedback (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  customer_id uuid not null references customers(id),
  delivery_id uuid references deliveries(id),
  rider_id uuid references profiles(id),
  overall_rating integer not null check (overall_rating between 1 and 5),
  delivery_rating integer check (delivery_rating between 1 and 5),
  product_rating integer check (product_rating between 1 and 5),
  timeliness_rating integer check (timeliness_rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index idx_customer_feedback_business on customer_feedback(business_id, created_at desc);
create index idx_customer_feedback_rider on customer_feedback(rider_id);

-- Cache of a generated monthly statement — the Statement page computes
-- live from customer_ledger_entries same as the admin Client Statement
-- always has (never a second source of truth for the figures); this row
-- just records that a statement for a given period was generated/viewed,
-- so a "Monthly Statement Ready" notification has something concrete to
-- point at and re-viewing a past month doesn't need to be recomputed
-- from raw ledger rows every time.
create table customer_statements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  customer_id uuid not null references customers(id),
  period_month date not null, -- first of month
  opening_balance numeric not null default 0,
  total_debit numeric not null default 0,
  total_credit numeric not null default 0,
  closing_balance numeric not null default 0,
  generated_at timestamptz not null default now(),
  unique (customer_id, period_month)
);

create index idx_customer_statements_customer on customer_statements(customer_id, period_month desc);

alter table customer_portal_users enable row level security;
alter table customer_otp_sessions enable row level security;
alter table customer_notifications enable row level security;
alter table customer_issues enable row level security;
alter table customer_feedback enable row level security;
alter table customer_statements enable row level security;

-- customer_portal_users: a customer reads their own row; staff with
-- settings.manage can see all (support/debugging). Writes only via
-- SECURITY DEFINER RPCs below (request_otp/verify_otp), never directly.
create policy p_customer_portal_users_self on customer_portal_users for select using (id = auth.uid());
create policy p_customer_portal_users_staff on customer_portal_users for select using (fn_has_permission('settings.manage'));

-- customer_otp_sessions: no direct client access at all — only the
-- SECURITY DEFINER functions below ever touch this table, using a
-- definer's implicit bypass of RLS. No policy is added on purpose (RLS
-- enabled with zero policies = no direct access for any role).

create policy p_customer_notifications_self on customer_notifications for select using (customer_id = fn_current_customer_id());
create policy p_customer_notifications_self_update on customer_notifications for update
  using (customer_id = fn_current_customer_id()) with check (customer_id = fn_current_customer_id());
create policy p_customer_notifications_business_isolation on customer_notifications as restrictive for all
  using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());
create trigger trg_stamp_business_id before insert on customer_notifications for each row execute function fn_stamp_business_id();

-- customer_issues: a customer can create and read their own; staff with
-- deliveries.edit (the same permission that already gates correcting a
-- delivery) can read/update all of the business's tickets.
create policy p_customer_issues_self_select on customer_issues for select using (customer_id = fn_current_customer_id());
create policy p_customer_issues_self_insert on customer_issues for insert with check (customer_id = fn_current_customer_id());
create policy p_customer_issues_staff_select on customer_issues for select using (fn_has_permission('deliveries.edit'));
create policy p_customer_issues_staff_update on customer_issues for update using (fn_has_permission('deliveries.edit')) with check (fn_has_permission('deliveries.edit'));
create policy p_customer_issues_business_isolation on customer_issues as restrictive for all
  using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());
create trigger trg_stamp_business_id before insert on customer_issues for each row execute function fn_stamp_business_id();

-- customer_feedback: a customer can create and read their own; staff
-- with deliveries.edit can read all (feedback dashboard).
create policy p_customer_feedback_self_select on customer_feedback for select using (customer_id = fn_current_customer_id());
create policy p_customer_feedback_self_insert on customer_feedback for insert with check (customer_id = fn_current_customer_id());
create policy p_customer_feedback_staff_select on customer_feedback for select using (fn_has_permission('deliveries.edit'));
create policy p_customer_feedback_business_isolation on customer_feedback as restrictive for all
  using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());
create trigger trg_stamp_business_id before insert on customer_feedback for each row execute function fn_stamp_business_id();

create policy p_customer_statements_self on customer_statements for select using (customer_id = fn_current_customer_id());
create policy p_customer_statements_staff on customer_statements for select using (fn_has_permission('settings.manage'));
create policy p_customer_statements_write on customer_statements for all
  using (fn_has_permission('settings.manage') or customer_id = fn_current_customer_id())
  with check (fn_has_permission('settings.manage') or customer_id = fn_current_customer_id());
create policy p_customer_statements_business_isolation on customer_statements as restrictive for all
  using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());
create trigger trg_stamp_business_id before insert on customer_statements for each row execute function fn_stamp_business_id();

-- Additional PERMISSIVE, read-only policies on the existing tables the
-- portal needs — additive alongside every staff policy already there,
-- and still subject to the restrictive business_isolation policy each of
-- these tables already has. A customer session can only ever read rows
-- where customer_id = fn_current_customer_id() — never write, never see
-- another customer's rows, never see expenses/journal/accounting.
create policy p_customers_self on customers for select using (id = fn_current_customer_id());
create policy p_deliveries_self on deliveries for select using (customer_id = fn_current_customer_id());
create policy p_delivery_items_self on delivery_items for select
  using (exists (select 1 from deliveries d where d.id = delivery_items.delivery_id and d.customer_id = fn_current_customer_id()));
create policy p_invoices_self on invoices for select using (customer_id = fn_current_customer_id());
create policy p_invoice_items_self on invoice_items for select
  using (exists (select 1 from invoices i where i.id = invoice_items.invoice_id and i.customer_id = fn_current_customer_id()));
create policy p_payments_self on payments for select using (customer_id = fn_current_customer_id());
create policy p_customer_ledger_entries_self on customer_ledger_entries for select using (customer_id = fn_current_customer_id());
create policy p_bottle_transactions_self on bottle_transactions for select using (customer_id = fn_current_customer_id());

-- request_otp: generates a 6-digit code, hashes it, stores it (5 minute
-- expiry), and returns the plaintext code ONLY to the caller (the server
-- action that then hands it to lib/twilio.js to actually send — this
-- function never sends anything itself, matching "notification sending
-- lives in app code, not the database" everywhere else in this app).
-- SECURITY DEFINER because customer_otp_sessions has no policies for the
-- anon/authenticated role to write to directly — the login flow runs
-- before any session exists, so it can't be gated on auth.uid() at all.
create or replace function public.fn_request_customer_otp(p_mobile text)
returns table(customer_id uuid, otp_code text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer record;
  v_code text;
  v_digits text;
begin
  -- customers.mobile is free-text (some rows "03001234567", some
  -- "+92 300 2199987", some already "923001234567") — matching on the
  -- trailing 10 digits (the part that's actually the phone number, once
  -- any leading 0 or country code is stripped) is the only reliable way
  -- to find the right customer regardless of how it was entered, on
  -- either side of the comparison.
  v_digits := right(regexp_replace(p_mobile, '\D', '', 'g'), 10);
  select c.id, c.business_id into v_customer from customers c
    where right(regexp_replace(c.mobile, '\D', '', 'g'), 10) = v_digits and c.is_active
    limit 1;
  if v_customer.id is null then
    raise exception 'No active customer found with this mobile number.';
  end if;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into customer_otp_sessions (business_id, customer_id, mobile, otp_hash, expires_at)
  values (v_customer.business_id, v_customer.id, p_mobile, encode(digest(v_code, 'sha256'), 'hex'), now() + interval '5 minutes');

  return query select v_customer.id, v_code;
end;
$function$;

grant execute on function public.fn_request_customer_otp(text) to anon, authenticated;

-- verify_otp: checks the most recent unverified, unexpired code for this
-- mobile against the hash, enforcing a 5-attempt cap per code (an OTP
-- session that's already used 5 wrong guesses is dead even if the code
-- itself hasn't expired yet — the usual OTP brute-force guard). Marks it
-- verified on success and returns the customer_id for the caller to then
-- create/reuse the actual auth.users session with (that part needs the
-- service-role admin client, so it stays in app code, not here).
create or replace function public.fn_verify_customer_otp(p_mobile text, p_code text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_session record;
begin
  select * into v_session from customer_otp_sessions
    where mobile = p_mobile and verified_at is null and expires_at > now()
    order by created_at desc limit 1;

  if v_session.id is null then
    raise exception 'No active OTP request for this number — request a new code.';
  end if;
  if v_session.attempt_count >= 5 then
    raise exception 'Too many incorrect attempts — request a new code.';
  end if;

  if v_session.otp_hash <> encode(digest(p_code, 'sha256'), 'hex') then
    update customer_otp_sessions set attempt_count = attempt_count + 1 where id = v_session.id;
    raise exception 'Incorrect code.';
  end if;

  update customer_otp_sessions set verified_at = now() where id = v_session.id;
  return v_session.customer_id;
end;
$function$;

grant execute on function public.fn_verify_customer_otp(text, text) to anon, authenticated;
