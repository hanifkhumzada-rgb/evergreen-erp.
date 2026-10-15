-- Smart Live Route Control: only an authenticated Delivery Boy may write
-- their own foreground duty location. Owner/Manager access remains read-only
-- through gps.view; customer portal visibility remains delivery-scoped.
drop policy if exists p_staff_locations_insert on public.staff_locations;

create policy p_staff_locations_insert
on public.staff_locations
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select public.fn_current_role_key()) = 'rider'
);
