-- Live GPS rider tracking — current-location only (no route history / trip
-- replay). A rider inserts their own position while on an active
-- delivery route; anyone holding gps.view (owner/admin/manager, already
-- granted) can read positions for their own business.
create table rider_locations (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references profiles(id) on delete cascade,
  business_id uuid not null references businesses(id),
  latitude numeric not null,
  longitude numeric not null,
  recorded_at timestamptz not null default now()
);

create index idx_rider_locations_rider_recorded on rider_locations (rider_id, recorded_at desc);
create index idx_rider_locations_business_recorded on rider_locations (business_id, recorded_at desc);

alter table rider_locations enable row level security;

-- Same multi-tenant isolation pattern as every other tenant-scoped table
-- (migration 0025) — restrictive, layered on top of the permissive
-- policies below, so neither one alone can leak across a business_id.
create policy p_business_isolation on rider_locations as restrictive for all
  using (business_id = fn_current_business_id())
  with check (business_id = fn_current_business_id());

create policy p_rider_locations_insert on rider_locations for insert
  with check (rider_id = auth.uid() and fn_current_role_key() = 'rider');

create policy p_rider_locations_select on rider_locations for select
  using (fn_has_permission('gps.view'));

create trigger trg_stamp_business_id before insert on rider_locations
  for each row execute function fn_stamp_business_id();

-- Realtime updates for the Live Tracking map (Supabase Realtime already
-- respects RLS for subscribers, same as every read above).
alter publication supabase_realtime add table rider_locations;
