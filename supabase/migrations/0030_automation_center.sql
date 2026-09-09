-- Automation Center (Phase 1) — extends the existing automation_rules
-- table (already the control surface for refresh_alerts()'s threshold
-- rules) with the fields a communication-automation row needs that a
-- pure alert-threshold row didn't: which channel it sends on, a
-- human-readable schedule note, and last-run/success/failed counters.
-- `category` distinguishes the two kinds of row this table now holds —
-- existing alert-threshold rows keep category='alert'; the Automation
-- Center's own rows below are category='communication'. Everything here
-- is a toggle/config row; the actual sending logic (Phase 3) reads it,
-- nothing here sends anything itself.
alter table automation_rules add column if not exists category text not null default 'alert';
alter table automation_rules add constraint automation_rules_category_check check (category in ('alert', 'communication'));
alter table automation_rules add column if not exists channel_whatsapp boolean not null default true;
alter table automation_rules add column if not exists channel_sms boolean not null default false;
alter table automation_rules add column if not exists schedule_note text;
alter table automation_rules add column if not exists last_run_at timestamptz;
alter table automation_rules add column if not exists success_count integer not null default 0;
alter table automation_rules add column if not exists failed_count integer not null default 0;

-- One row per business (matches how every other automation_rules row is
-- already seeded — see 0009/earlier phases) rather than a single global
-- insert, so this stays correct if a second business is ever added.
do $$
declare
  biz record;
begin
  for biz in select id from businesses loop
    insert into automation_rules (key, label, description, enabled, threshold_value, category, business_id)
    values ('low_activity', 'Low order activity', 'Flags a customer whose order volume (bottles) this month has dropped significantly vs last month — the same drop already used by Evergreen AI''s follow-up answer, now a standing alert.', true, 30, 'alert', biz.id)
    on conflict do nothing;

    insert into automation_rules (key, label, description, enabled, threshold_value, category, channel_whatsapp, channel_sms, schedule_note, business_id) values
      ('payment_reminders', 'Payment Reminders', 'Reminds customers with an upcoming or overdue balance, respecting each customer''s payment frequency and the reminder timing configured here.', false, 3, 'communication', true, false, 'Daily check, respects quiet hours', biz.id),
      ('delivery_messages', 'Delivery Confirmation Messages', 'Sends a confirmation message to the customer right after their delivery is marked complete.', false, 0, 'communication', true, false, 'Triggered on delivery completion', biz.id),
      ('payment_receipts', 'Payment Receipt Messages', 'Sends a receipt message to the customer right after a payment is recorded.', false, 0, 'communication', true, false, 'Triggered on payment recorded', biz.id),
      ('monthly_statements', 'Monthly Statement Ready', 'Notifies customers when their monthly statement is ready to view or download.', false, 1, 'communication', true, false, 'Monthly, 1st of month', biz.id),
      ('customer_followup', 'Customer Follow-up', 'Sends a check-in message to customers flagged for follow-up — inactive, order drop, or a low feedback rating.', false, 0, 'communication', true, false, 'Daily check', biz.id),
      ('owner_alerts', 'Owner Alerts', 'Pushes the alerts the rules above already generate (low stock, overdue, bottle balance, etc.) to the Owner over WhatsApp/SMS, in addition to the in-app Notifications page.', false, 0, 'communication', true, false, 'Real-time as alerts are generated', biz.id),
      ('daily_summary', 'Daily Summary', 'Sends the Evergreen AI daily business brief to the Owner every morning.', false, 8, 'communication', true, false, 'Daily 8:00 AM', biz.id)
    on conflict do nothing;
  end loop;
end $$;

-- refresh_alerts() extended with the low_activity check — same 30-day
-- month-over-month bottle-quantity drop already computed ad hoc by
-- getReducedOrderCustomers() in app/actions.js (used today only for the
-- AI chat's on-demand follow-up answer), now a standing alert like every
-- other automation_rules-gated check in this function. Existing checks
-- are reproduced byte-for-byte from the current definition — only the
-- new block at the end is added.
create or replace function public.refresh_alerts()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  owner_role_id uuid;
  r record;
  rule_stock_reorder boolean;
  rule_outstanding boolean;
  rule_outstanding_threshold numeric;
  rule_bottle_limit boolean;
  rule_inactive boolean;
  rule_inactive_days numeric;
  rule_payment_overdue boolean;
  rule_payment_overdue_days numeric;
  rule_high_balance boolean;
  rule_high_balance_pct numeric;
  rule_shortage boolean;
  rule_shortage_days numeric;
  rule_unreconciled boolean;
  rule_unreconciled_days numeric;
  rule_damaged boolean;
  rule_damaged_threshold numeric;
  rule_lost boolean;
  rule_lost_threshold numeric;
  rule_low_activity boolean;
  rule_low_activity_pct numeric;
begin
  if coalesce(fn_current_role_key(), '') not in ('owner', 'manager', 'accountant') then
    raise exception 'permission denied: refresh_alerts requires owner, manager, or accountant';
  end if;

  select id into owner_role_id from roles where key = 'owner';

  select enabled into rule_stock_reorder from automation_rules where key = 'stock_reorder';
  select enabled, threshold_value into rule_outstanding, rule_outstanding_threshold from automation_rules where key = 'outstanding_balance';
  select enabled into rule_bottle_limit from automation_rules where key = 'bottle_limit';
  select enabled, threshold_value into rule_inactive, rule_inactive_days from automation_rules where key = 'customer_inactive';
  select enabled, threshold_value into rule_payment_overdue, rule_payment_overdue_days from automation_rules where key = 'payment_overdue';
  select enabled, threshold_value into rule_high_balance, rule_high_balance_pct from automation_rules where key = 'high_bottle_balance';
  select enabled, threshold_value into rule_shortage, rule_shortage_days from automation_rules where key = 'bottle_shortage';
  select enabled, threshold_value into rule_unreconciled, rule_unreconciled_days from automation_rules where key = 'unreconciled_bottles';
  select enabled, threshold_value into rule_damaged, rule_damaged_threshold from automation_rules where key = 'damaged_bottle_increase';
  select enabled, threshold_value into rule_lost, rule_lost_threshold from automation_rules where key = 'lost_bottle_increase';
  select enabled, threshold_value into rule_low_activity, rule_low_activity_pct from automation_rules where key = 'low_activity';

  delete from notifications where type in (
    'low_stock','overdue_payment','bottle_limit','inactive_customer','payment_overdue',
    'high_bottle_balance','bottle_shortage','unreconciled_bottles','damaged_bottle_increase','lost_bottle_increase',
    'low_activity'
  ) and is_read = false;

  if coalesce(rule_stock_reorder, true) then
    for r in
      select p.name, s.warehouse, p.low_stock_threshold
      from products p
      join v_bottle_reconciliation s on s.product_id = p.id
      where s.warehouse < p.low_stock_threshold
    loop
      insert into notifications (type, title, message, severity, target_role_id)
        values ('low_stock', 'Low stock: ' || r.name,
          r.name || ' is at ' || r.warehouse || ' units, below reorder level of ' || r.low_stock_threshold || '.',
          'warning', owner_role_id);
    end loop;
  end if;

  if coalesce(rule_outstanding, true) then
    for r in
      select name, balance from v_customer_balance where balance > coalesce(rule_outstanding_threshold, 10000)
    loop
      insert into notifications (type, title, message, severity, target_role_id)
        values ('overdue_payment', 'Outstanding: ' || r.name,
          r.name || ' has an outstanding balance of PKR ' || round(r.balance) || '.',
          'critical', owner_role_id);
    end loop;
  end if;

  if coalesce(rule_bottle_limit, true) then
    for r in
      select c.name, sum(v.bottles_with_customer) as bal, c.bottle_limit
      from v_customer_bottle_balance v
      join customers c on c.id = v.customer_id
      group by c.id, c.name, c.bottle_limit
      having sum(v.bottles_with_customer) > c.bottle_limit
    loop
      insert into notifications (type, title, message, severity, target_role_id)
        values ('bottle_limit', 'Bottle limit: ' || r.name,
          r.name || ' is holding ' || r.bal || ' bottles, above their limit of ' || r.bottle_limit || '.',
          'warning', owner_role_id);
    end loop;
  end if;

  if coalesce(rule_inactive, true) then
    for r in
      select c.name
      from customers c
      where c.is_active
        and not exists (
          select 1 from deliveries d where d.customer_id = c.id and d.delivery_date > current_date - make_interval(days => coalesce(rule_inactive_days, 15)::int)
        )
        and not exists (
          select 1 from invoices i where i.customer_id = c.id and i.invoice_date > current_date - make_interval(days => coalesce(rule_inactive_days, 15)::int)
        )
        and c.created_at < current_date - make_interval(days => coalesce(rule_inactive_days, 15)::int)
    loop
      insert into notifications (type, title, message, severity, target_role_id)
        values ('inactive_customer', 'Inactive: ' || r.name,
          r.name || ' has had no delivery or sale in the last ' || coalesce(rule_inactive_days, 15) || ' days.',
          'info', owner_role_id);
    end loop;
  end if;

  if coalesce(rule_payment_overdue, true) then
    for r in
      select i.invoice_no, c.name, i.due_date, i.net_amount
      from invoices i
      join customers c on c.id = i.customer_id
      where i.status not in ('paid'::invoice_status, 'void'::invoice_status)
        and i.due_date is not null
        and i.due_date < current_date - make_interval(days => coalesce(rule_payment_overdue_days, 30)::int)
    loop
      insert into notifications (type, title, message, severity, target_role_id)
        values ('payment_overdue', 'Payment overdue: ' || r.name,
          'Invoice ' || r.invoice_no || ' for ' || r.name || ' (PKR ' || round(r.net_amount) || ') is overdue since ' || r.due_date || '.',
          'critical', owner_role_id);
    end loop;
  end if;

  if coalesce(rule_high_balance, true) then
    for r in
      select s.product_name, s.with_customer, s.total_assets
      from v_bottle_reconciliation s
      where s.total_assets > 0
        and (s.with_customer::numeric / s.total_assets) * 100 > coalesce(rule_high_balance_pct, 70)
    loop
      insert into notifications (type, title, message, severity, target_role_id)
        values ('high_bottle_balance', 'High bottle balance: ' || r.product_name,
          round((r.with_customer::numeric / r.total_assets) * 100) || '% of ' || r.product_name || ' stock (' || r.with_customer || ' of ' || r.total_assets || ') is currently with customers.',
          'warning', owner_role_id);
    end loop;
  end if;

  if coalesce(rule_shortage, true) then
    for r in
      select p.name, br.physical_qty, br.expected_qty, br.difference, br.recon_date
      from bottle_reconciliations br
      join products p on p.id = br.product_id
      where br.difference < 0
        and br.recon_date > current_date - make_interval(days => coalesce(rule_shortage_days, 7)::int)
    loop
      insert into notifications (type, title, message, severity, target_role_id)
        values ('bottle_shortage', 'Bottle shortage: ' || r.name,
          r.name || ' reconciliation on ' || r.recon_date || ' found ' || r.physical_qty || ' physical vs ' || r.expected_qty || ' expected (short by ' || abs(r.difference) || ').',
          'critical', owner_role_id);
    end loop;
  end if;

  if coalesce(rule_unreconciled, true) then
    for r in
      select p.id, p.name, max(br.recon_date) as last_recon
      from products p
      left join bottle_reconciliations br on br.product_id = p.id
      where p.is_active
      group by p.id, p.name
      having max(br.recon_date) is null or max(br.recon_date) < current_date - make_interval(days => coalesce(rule_unreconciled_days, 30)::int)
    loop
      insert into notifications (type, title, message, severity, target_role_id)
        values ('unreconciled_bottles', 'Unreconciled: ' || r.name,
          r.name || ' has ' || coalesce('not been reconciled since ' || r.last_recon, 'never been reconciled') || '.',
          'info', owner_role_id);
    end loop;
  end if;

  if coalesce(rule_damaged, true) then
    for r in
      select p.name, sum(bt.quantity) as qty
      from bottle_transactions bt
      join products p on p.id = bt.product_id
      where bt.to_state = 'damaged'::bottle_state and bt.txn_date > current_date - interval '7 days'
      group by p.id, p.name
      having sum(bt.quantity) > coalesce(rule_damaged_threshold, 5)
    loop
      insert into notifications (type, title, message, severity, target_role_id)
        values ('damaged_bottle_increase', 'Damaged bottles rising: ' || r.name,
          r.qty || ' ' || r.name || ' bottles reported damaged in the last 7 days.',
          'warning', owner_role_id);
    end loop;
  end if;

  if coalesce(rule_lost, true) then
    for r in
      select p.name, sum(bt.quantity) as qty
      from bottle_transactions bt
      join products p on p.id = bt.product_id
      where bt.to_state = 'lost'::bottle_state and bt.txn_date > current_date - interval '7 days'
      group by p.id, p.name
      having sum(bt.quantity) > coalesce(rule_lost_threshold, 3)
    loop
      insert into notifications (type, title, message, severity, target_role_id)
        values ('lost_bottle_increase', 'Lost bottles rising: ' || r.name,
          r.qty || ' ' || r.name || ' bottles reported lost in the last 7 days.',
          'critical', owner_role_id);
    end loop;
  end if;

  -- Low order activity — same month-over-month bottle-quantity comparison
  -- as getReducedOrderCustomers() (app/actions.js), reproduced in SQL so
  -- it can run as a standing alert instead of only on-demand from the AI
  -- chat. A customer needs real volume last month (>0) to avoid flagging
  -- brand-new customers who simply hadn't ordered yet.
  if coalesce(rule_low_activity, true) then
    for r in
      with this_month as (
        select ii.invoice_id, i.customer_id, sum(ii.quantity) as qty
        from invoice_items ii join invoices i on i.id = ii.invoice_id
        where i.status <> 'void'::invoice_status and i.invoice_date >= date_trunc('month', current_date)
        group by ii.invoice_id, i.customer_id
      ), this_month_totals as (
        select customer_id, sum(qty) as qty from this_month group by customer_id
      ), last_month as (
        select ii.invoice_id, i.customer_id, sum(ii.quantity) as qty
        from invoice_items ii join invoices i on i.id = ii.invoice_id
        where i.status <> 'void'::invoice_status
          and i.invoice_date >= date_trunc('month', current_date) - interval '1 month'
          and i.invoice_date < date_trunc('month', current_date)
        group by ii.invoice_id, i.customer_id
      ), last_month_totals as (
        select customer_id, sum(qty) as qty from last_month group by customer_id
      )
      select c.name, lmt.qty as prev_qty, coalesce(tmt.qty, 0) as cur_qty,
        round(((coalesce(tmt.qty, 0) - lmt.qty)::numeric / lmt.qty) * 100) as pct_change
      from last_month_totals lmt
      join customers c on c.id = lmt.customer_id
      left join this_month_totals tmt on tmt.customer_id = lmt.customer_id
      where lmt.qty > 0
        and ((coalesce(tmt.qty, 0) - lmt.qty)::numeric / lmt.qty) * 100 <= -coalesce(rule_low_activity_pct, 30)
    loop
      insert into notifications (type, title, message, severity, target_role_id)
        values ('low_activity', 'Low activity: ' || r.name,
          r.name || '''s orders are down ' || abs(r.pct_change) || '% this month (' || r.cur_qty || ' vs ' || r.prev_qty || ' bottles last month).',
          'info', owner_role_id);
    end loop;
  end if;
end;
$function$;
