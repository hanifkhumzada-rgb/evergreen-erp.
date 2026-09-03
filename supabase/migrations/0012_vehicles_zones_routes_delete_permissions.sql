-- Section 6-7 (non-financial modules): hard delete is allowed here, but
-- gated by its own permission, separate from "manage" (create/edit) — an
-- Owner should be able to grant someone the ability to edit fleet/zone/
-- route master data without also granting the ability to delete it. The
-- existing FK constraints from customers/deliveries/expenses/profiles into
-- these three tables are all NO ACTION (verified), so the database already
-- refuses to delete a vehicle/zone/route that's still referenced anywhere
-- — the app layer just needs to surface that as a clean error instead of
-- a raw FK violation.

insert into permissions (key, module, description) values
  ('vehicles.delete', 'vehicles', 'Delete vehicles'),
  ('zones.delete', 'zones', 'Delete zones'),
  ('routes.delete', 'routes', 'Delete routes')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key in ('owner', 'admin', 'manager') and p.key in ('vehicles.delete', 'zones.delete', 'routes.delete')
on conflict do nothing;

-- vehicles: split the existing "ALL" policy into select/insert/update
-- (still vehicles.manage, unchanged behavior) + a new delete-specific one.
drop policy if exists p_vehicles_write on vehicles;
create policy p_vehicles_insert on vehicles for insert with check (fn_has_permission('vehicles.manage'));
create policy p_vehicles_update on vehicles for update using (fn_has_permission('vehicles.manage')) with check (fn_has_permission('vehicles.manage'));
create policy p_vehicles_delete on vehicles for delete using (fn_has_permission('vehicles.delete'));

-- zones: same split (was settings.manage for everything).
drop policy if exists p_zones_write on zones;
create policy p_zones_insert on zones for insert with check (fn_has_permission('settings.manage'));
create policy p_zones_update on zones for update using (fn_has_permission('settings.manage')) with check (fn_has_permission('settings.manage'));
create policy p_zones_delete on zones for delete using (fn_has_permission('zones.delete'));

-- routes: same split (was settings.manage for everything).
drop policy if exists p_routes_write on routes;
create policy p_routes_insert on routes for insert with check (fn_has_permission('settings.manage'));
create policy p_routes_update on routes for update using (fn_has_permission('settings.manage')) with check (fn_has_permission('settings.manage'));
create policy p_routes_delete on routes for delete using (fn_has_permission('routes.delete'));
