-- A request-scoped key prevents network/offline retries from double posting,
-- without blocking legitimate multiple deliveries to one customer on a day.
alter table public.deliveries
  add column if not exists request_id text;

create unique index if not exists deliveries_business_request_id_uidx
  on public.deliveries (business_id, request_id)
  where request_id is not null;
