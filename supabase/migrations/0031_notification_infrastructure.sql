-- Notification infrastructure (Phase 3) — templates + a send log every
-- WhatsApp/SMS attempt writes to, whether it actually reached Twilio or
-- not. Nothing here sends anything; lib/twilio.js (app code) is what
-- calls the Twilio REST API and writes the result here.
create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  description text,
  body_template text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  business_id uuid not null references businesses(id),
  unique (business_id, key)
);

-- status never jumps straight to 'delivered' from app code — only a
-- Twilio status-callback webhook (POST /api/webhooks/twilio-status) can
-- move a row from 'sent' to 'delivered' or 'failed', because that's the
-- only place an actual delivery confirmation from Twilio arrives.
-- 'sent' means Twilio's synchronous API response confirmed it accepted
-- the message (a real HTTP 201 + message SID), not that a human read it.
create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  customer_id uuid references customers(id),
  template_key text not null,
  channel text not null check (channel in ('whatsapp', 'sms')),
  to_number text not null,
  message_body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed')),
  provider text not null default 'twilio',
  provider_message_sid text,
  error_message text,
  related_type text,
  related_id uuid,
  attempt_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index idx_notification_logs_business_created on notification_logs(business_id, created_at desc);
create index idx_notification_logs_related on notification_logs(related_type, related_id);
create index idx_notification_logs_status on notification_logs(business_id, status);
create index idx_notification_logs_customer on notification_logs(customer_id);

-- Idempotency: at most one log row per (business, related record,
-- template) — a delivery/payment save that runs twice (double-click,
-- client retry) hits this unique index on the second attempt; the send
-- function treats that as "already handled", not an error. General
-- (non-event-triggered) sends — reminders, announcements — have no
-- related_type/related_id and aren't covered by this index, since a
-- reminder job intentionally sends once per customer per run, not once
-- ever.
create unique index idx_notification_logs_idempotency on notification_logs(business_id, related_type, related_id, template_key)
  where related_type is not null and related_id is not null;

alter table notification_templates enable row level security;
alter table notification_logs enable row level security;

create policy p_notification_templates_select on notification_templates for select using (auth.uid() is not null);
create policy p_notification_templates_write on notification_templates for all
  using (fn_has_permission('settings.manage')) with check (fn_has_permission('settings.manage'));
create policy p_notification_templates_business_isolation on notification_templates as restrictive for all
  using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

-- Read/manage restricted to settings.manage (owner/admin) — message
-- bodies carry customer names/amounts/phone numbers, and retrying a send
-- is an action with a real (if small) cost. Insert is open to any
-- authenticated session because a send can be triggered from many roles'
-- actions (a rider completing a delivery, an accountant recording a
-- payment) — this is a log entry, not sensitive to create, only to read.
create policy p_notification_logs_select on notification_logs for select using (fn_has_permission('settings.manage'));
create policy p_notification_logs_insert on notification_logs for insert with check (auth.uid() is not null);
create policy p_notification_logs_update on notification_logs for update
  using (fn_has_permission('settings.manage')) with check (fn_has_permission('settings.manage'));
create policy p_notification_logs_business_isolation on notification_logs as restrictive for all
  using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

create trigger trg_stamp_business_id before insert on notification_templates for each row execute function fn_stamp_business_id();
create trigger trg_stamp_business_id before insert on notification_logs for each row execute function fn_stamp_business_id();

-- Seed the eight templates the brief asks for, one row per business.
-- {{placeholders}} are substituted by lib/twilio.js's renderTemplate()
-- before sending — never by SQL. Enabled by default: whether anything
-- actually sends is still gated by the matching Automation Center
-- communication row (payment_reminders/delivery_messages/...) AND
-- Twilio being configured, so an enabled-but-unused template here is
-- harmless.
do $$
declare
  biz record;
begin
  for biz in select id from businesses loop
    insert into notification_templates (key, name, description, body_template, business_id) values
      ('delivery_confirmation', 'Delivery Confirmation', 'Sent right after a delivery is marked complete.',
        'Hi {{customer_name}}, your delivery of {{quantity}} bottle(s) has been completed today. Thank you for choosing Evergreen Water!', biz.id),
      ('payment_reminder', 'Payment Reminder', 'Sent to customers with an upcoming or overdue balance.',
        'Hi {{customer_name}}, this is a reminder from Evergreen Water — your outstanding balance is PKR {{amount}}. Please arrange payment at your earliest convenience. Thank you!', biz.id),
      ('payment_received', 'Payment Received', 'Sent right after a payment is recorded.',
        'Hi {{customer_name}}, we''ve received your payment of PKR {{amount}} (Receipt {{receipt_no}}). Thank you!', biz.id),
      ('monthly_statement_ready', 'Monthly Statement Ready', 'Sent when a customer''s monthly statement is ready.',
        'Hi {{customer_name}}, your Evergreen Water statement for {{period}} is ready. Outstanding balance: PKR {{amount}}. View it in My Evergreen Water.', biz.id),
      ('outstanding_balance_alert', 'Outstanding Balance Alert', 'Sent when a balance crosses the outstanding-balance threshold.',
        'Hi {{customer_name}}, your outstanding balance with Evergreen Water is now PKR {{amount}}. Please arrange payment to avoid any delivery interruption.', biz.id),
      ('feedback_request', 'Feedback Request', 'Sent to ask a customer for feedback after a delivery.',
        'Hi {{customer_name}}, how was your recent delivery from Evergreen Water? We''d love your feedback — reply or rate us in My Evergreen Water.', biz.id),
      ('issue_update', 'Issue Update', 'Sent when a customer''s reported issue changes status.',
        'Hi {{customer_name}}, your reported issue "{{issue_type}}" is now {{status}}. {{resolution_note}}', biz.id),
      ('general_announcement', 'General Announcement', 'A general one-off announcement to a customer or group.',
        '{{message}}', biz.id)
    on conflict do nothing;
  end loop;
end $$;
