-- Critical audit finding (2026-09-22): riders could not record a single
-- delivery through the app's primary rider-facing flow (DeliverSheet,
-- OneTapDeliverButton, DeliveryForm — all three call createDelivery(),
-- which calls fn_record_water_delivery(), added by the
-- "water_business_checklist" migration on 2026-09-16). That function is
-- SECURITY INVOKER, so every insert inside it runs as the calling rider
-- and must pass RLS:
--   - deliveries / delivery_items INSERT requires 'deliveries.create'
--   - bottle_transactions INSERT requires 'bottles.manage'
-- The rider role's permission set (role_permissions) has never included
-- either — riders only ever had 'deliveries.edit' (for the older
-- update-an-existing-pending-delivery flow) and 'bottles.view'. The new
-- function's own app-level check (`fn_has_permission('deliveries.create')
-- AND fn_has_permission('deliveries.edit')`) made this fail immediately
-- and unconditionally for every rider, every time — confirmed live via
-- role_permissions/pg_policies, not inferred from code alone.
--
-- Fix: grant the two missing permissions to 'rider'. This is additive —
-- it does not touch any other role — and matches what the feature was
-- clearly designed for (a rider recording a completed delivery on the
-- spot inherently creates that delivery's row and moves bottle
-- inventory state; both actions are scoped to their own business via
-- the standard p_business_isolation policy and, for deliveries
-- specifically, further scoped to the rider's own assigned customers by
-- fn_record_water_delivery's own rider_id/assigned_rider_id check).
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.key = 'rider'
  and p.key in ('deliveries.create', 'bottles.manage')
  and not exists (
    select 1 from role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );
