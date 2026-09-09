-- Reminder-job config the payment_reminders automation needs beyond a
-- single threshold_value: how many times to remind a customer at most,
-- and a quiet-hours window the reminder cron won't send inside. Generic
-- columns (not payment-reminder-specific names) so any future automation
-- can reuse them the same way threshold_value already is.
alter table automation_rules add column if not exists max_reminders integer not null default 3;
alter table automation_rules add column if not exists quiet_hours_start integer not null default 21; -- 9pm
alter table automation_rules add column if not exists quiet_hours_end integer not null default 8; -- 8am (wraps past midnight)

update automation_rules set max_reminders = 3, quiet_hours_start = 21, quiet_hours_end = 8 where key = 'payment_reminders';

-- One row per reminder actually sent (or attempted) to a customer about a
-- specific invoice — what the reminder cron reads to enforce
-- max_reminders ("don't send a 4th reminder for the same invoice") and
-- what the customer's Payments/Statement views can show ("last reminded
-- 3 days ago"). Distinct from notification_logs (a generic send record
-- for every channel/template) — this table only tracks the
-- payment-reminder domain concept of "how many times has this customer
-- been reminded about this balance", which needs its own count separate
-- from the generic notification history.
create table payment_reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  customer_id uuid not null references customers(id),
  invoice_id uuid references invoices(id),
  notification_log_id uuid references notification_logs(id),
  sent_at timestamptz not null default now(),
  channel text not null check (channel in ('whatsapp', 'sms'))
);

create index idx_payment_reminders_customer on payment_reminders(customer_id, sent_at desc);
create index idx_payment_reminders_business on payment_reminders(business_id, sent_at desc);

alter table payment_reminders enable row level security;
create policy p_payment_reminders_select on payment_reminders for select using (fn_has_permission('settings.manage'));
create policy p_payment_reminders_insert on payment_reminders for insert with check (auth.uid() is not null);
create policy p_payment_reminders_business_isolation on payment_reminders as restrictive for all
  using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());
create trigger trg_stamp_business_id before insert on payment_reminders for each row execute function fn_stamp_business_id();
