-- A rider must never see or post operational data for an unassigned
-- customer, even when calling PostgREST directly instead of using the UI.

drop policy if exists p_deliveries_insert on public.deliveries;
create policy p_deliveries_insert on public.deliveries
for insert to authenticated
with check (
  (select fn_has_permission('deliveries.create'))
  and (
    (select fn_current_role_key()) <> 'rider'
    or (
      rider_id = (select auth.uid())
      and exists (
        select 1 from public.customers c
        where c.id = deliveries.customer_id
          and c.assigned_rider_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists p_delivery_items_write on public.delivery_items;
drop policy if exists p_delivery_items_select on public.delivery_items;
drop policy if exists p_delivery_items_insert on public.delivery_items;
drop policy if exists p_delivery_items_update on public.delivery_items;
drop policy if exists p_delivery_items_delete on public.delivery_items;

create policy p_delivery_items_select on public.delivery_items
for select to authenticated
using (
  (select fn_has_permission('deliveries.view'))
  and (
    (select fn_current_role_key()) <> 'rider'
    or exists (
      select 1 from public.deliveries d
      where d.id = delivery_items.delivery_id
        and d.rider_id = (select auth.uid())
    )
  )
);

create policy p_delivery_items_insert on public.delivery_items
for insert to authenticated
with check (
  (select fn_has_permission('deliveries.create'))
  and exists (
    select 1 from public.deliveries d
    where d.id = delivery_items.delivery_id
      and (
        (select fn_current_role_key()) <> 'rider'
        or d.rider_id = (select auth.uid())
      )
  )
);

create policy p_delivery_items_update on public.delivery_items
for update to authenticated
using (
  (select fn_has_permission('deliveries.edit'))
  and exists (
    select 1 from public.deliveries d
    where d.id = delivery_items.delivery_id
      and (
        (select fn_current_role_key()) <> 'rider'
        or d.rider_id = (select auth.uid())
      )
  )
)
with check (
  (select fn_has_permission('deliveries.edit'))
  and exists (
    select 1 from public.deliveries d
    where d.id = delivery_items.delivery_id
      and (
        (select fn_current_role_key()) <> 'rider'
        or d.rider_id = (select auth.uid())
      )
  )
);

create policy p_delivery_items_delete on public.delivery_items
for delete to authenticated
using ((select fn_current_role_key()) in ('owner', 'admin'));

drop policy if exists p_payments_insert on public.payments;
create policy p_payments_insert on public.payments
for insert to authenticated
with check (
  (select fn_has_permission('payments.create'))
  and (
    (select fn_current_role_key()) <> 'rider'
    or (
      received_by = (select auth.uid())
      and exists (
        select 1 from public.customers c
        where c.id = payments.customer_id
          and c.assigned_rider_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists p_bottle_txn_select on public.bottle_transactions;
create policy p_bottle_txn_select on public.bottle_transactions
for select to authenticated
using (
  (select fn_has_permission('bottles.view'))
  and (
    (select fn_current_role_key()) <> 'rider'
    or rider_id = (select auth.uid())
    or exists (
      select 1 from public.customers c
      where c.id = bottle_transactions.customer_id
        and c.assigned_rider_id = (select auth.uid())
    )
  )
);

drop policy if exists p_bottle_txn_insert on public.bottle_transactions;
create policy p_bottle_txn_insert on public.bottle_transactions
for insert to authenticated
with check (
  (select fn_has_permission('bottles.manage'))
  and (
    (select fn_current_role_key()) <> 'rider'
    or (
      (rider_id is null or rider_id = (select auth.uid()))
      and exists (
        select 1 from public.customers c
        where c.id = bottle_transactions.customer_id
          and c.assigned_rider_id = (select auth.uid())
      )
    )
  )
);
