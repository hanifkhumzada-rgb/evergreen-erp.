-- These 4 tables had an overly-permissive ALL-command policy
-- (auth.uid() IS NOT NULL) letting any authenticated user insert/update/
-- delete rows regardless of role or permissions. Replace with the same
-- fn_has_permission-gated split already used correctly elsewhere in this
-- schema (e.g. p_attendance_select/p_attendance_write, p_vehicles_select/
-- p_vehicles_write).

-- employee_advances: mirror employee_attendance's existing correct pattern
-- (self can view own, users.manage required to view/write anyone else's).
drop policy if exists p_employee_advances_all on employee_advances;

create policy p_employee_advances_select on employee_advances
  for select
  using (fn_has_permission('users.manage') or employee_id = auth.uid());

create policy p_employee_advances_write on employee_advances
  for all
  using (fn_has_permission('users.manage'))
  with check (fn_has_permission('users.manage'));

-- employee_attendance: the correct p_attendance_select/p_attendance_write
-- policies already exist; this redundant permissive one just needs to go.
drop policy if exists p_employee_attendance_all on employee_attendance;

-- production_batches: reuse the existing inventory.view/inventory.manage
-- permissions (production directly consumes and produces bottle inventory,
-- same operational domain vehicles/zones-style 2-tier split already uses
-- elsewhere).
drop policy if exists p_production_batches_all on production_batches;

create policy p_production_batches_select on production_batches
  for select
  using (fn_has_permission('inventory.view'));

create policy p_production_batches_write on production_batches
  for all
  using (fn_has_permission('inventory.manage'))
  with check (fn_has_permission('inventory.manage'));

-- routes: master/reference data, same treatment as zones (open read for any
-- authenticated user, settings.manage required to write) since no
-- dedicated "routes" permission exists in the catalog and zones didn't get
-- one either.
drop policy if exists p_routes_all on routes;

create policy p_routes_select on routes
  for select
  using (auth.uid() is not null);

create policy p_routes_write on routes
  for all
  using (fn_has_permission('settings.manage'))
  with check (fn_has_permission('settings.manage'));
