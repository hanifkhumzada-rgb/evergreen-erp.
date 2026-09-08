-- Recurring/subscription order automation — lets a customer's recurring
-- schedule be paused, resumed, or cancelled independent of their
-- historical records. The daily cron (see 0028 + app/api/cron/
-- recurring-orders) only ever generates automatic pending deliveries for
-- recurring_status = 'active' customers.
alter table customers add column if not exists recurring_status text not null default 'active';

alter table customers add constraint customers_recurring_status_check
  check (recurring_status in ('active', 'paused', 'cancelled'));

alter table customers add column if not exists recurring_status_updated_at timestamptz;
alter table customers add column if not exists recurring_status_updated_by uuid references profiles(id);
