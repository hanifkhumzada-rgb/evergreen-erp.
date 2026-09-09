-- Customer Portal Dashboard — "your delivery is out for delivery, here's
-- your rider's live location" (reuses the existing GPS tracking
-- infrastructure: rider_locations + its Realtime publication, migration
-- 0028). rider_locations currently has no customer-facing policy at all
-- (p_rider_locations_select is gps.view-gated, staff only) — a customer
-- session reads zero rows today, so this needs its own narrow policy,
-- not a blanket "see your rider" grant.
--
-- Scope, deliberately tight: a customer may see a rider_locations row
-- ONLY while that rider has a delivery assigned to THIS customer, dated
-- today, currently in 'out_for_delivery' status. The moment that
-- delivery is marked delivered/missed/cancelled/etc., the exists-check
-- below goes false and the row disappears from what the customer can
-- select — never a standing grant to track a rider, never visibility
-- into a rider's deliveries to OTHER customers (a different customer_id
-- means a different delivery row, so the same rider serving customer B
-- right now does not make customer A's exists-check true), and never
-- other riders entirely.
--
-- Realtime already respects RLS for subscribers (confirmed in migration
-- 0028's own comment, and how the staff Live Tracking map already relies
-- on it) — so this same policy is what makes a customer's Realtime
-- subscription for rider_locations INSERTs correctly receive only their
-- own assigned rider's live position while out for delivery to them, and
-- nothing else, with no separate mechanism needed.
create policy p_rider_locations_customer_self on rider_locations for select
  using (
    exists (
      select 1 from deliveries d
      where d.rider_id = rider_locations.rider_id
        and d.customer_id = fn_current_customer_id()
        and d.status = 'out_for_delivery'
        and d.delivery_date = current_date
    )
  );
