-- Generalizes Live GPS Tracking from riders-only (only while actively out
-- on a delivery route) to every logged-in staff member (Owner/Admin/
-- Manager/Accountant/Rider), any time they have the app open. Renamed
-- rather than duplicated into a parallel table — same shape, same
-- Realtime setup, just a broader audience and a name that no longer
-- implies "riders only".
--
-- Flagged plainly for the record: continuous location tracking of
-- office staff (not just riders on a delivery) is a materially more
-- invasive default than the original delivery-scoped design. Implemented
-- as requested — this is the Owner's call for their own team — but it's
-- a real change in what the app collects about people, worth being
-- explicit about rather than burying in a rename.

alter table rider_locations rename to staff_locations;
alter table staff_locations rename column rider_id to user_id;

alter index idx_rider_locations_rider_recorded rename to idx_staff_locations_user_recorded;
alter index idx_rider_locations_business_recorded rename to idx_staff_locations_business_recorded;

-- Renamed only (same condition, same expression — Postgres resolves
-- policy quals by attribute number, not name, so the rename above never
-- broke these; this just keeps their names in sync with the table).
alter policy p_rider_locations_select on staff_locations rename to p_staff_locations_select;
alter policy p_rider_locations_customer_self on staff_locations rename to p_staff_locations_customer_self;

-- The actual behavior change: any authenticated STAFF session (never a
-- customer-portal session) may report their own position — no longer
-- restricted to the rider role, and no longer conditioned on having an
-- active delivery route.
drop policy p_rider_locations_insert on staff_locations;
create policy p_staff_locations_insert on staff_locations for insert
  with check (user_id = auth.uid() and fn_current_role_key() is not null and fn_current_role_key() <> 'customer');

-- Owner-controlled toggle (Automation Center) for whether the Customer
-- Portal's live rider map shows at all — defaults to on, matching
-- today's behavior, so this migration alone changes nothing customer-
-- facing until the Owner explicitly turns it off.
alter table business_settings add column if not exists customer_live_tracking_enabled boolean not null default true;
