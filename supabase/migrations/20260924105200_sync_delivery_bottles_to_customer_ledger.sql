-- Keep the customer ledger bottle columns aligned with delivery item quantities.
-- Financial values are untouched; this trigger only synchronizes bottle movement.

create or replace function public.fn_sync_delivery_bottles_to_customer_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_id uuid := coalesce(new.delivery_id, old.delivery_id);
  v_delivered integer;
  v_returned integer;
begin
  select coalesce(sum(delivered_qty), 0)::integer,
         coalesce(sum(returned_qty), 0)::integer
    into v_delivered, v_returned
    from public.delivery_items
   where delivery_id = v_delivery_id;

  update public.customer_ledger_entries
     set bottles_out = v_delivered,
         bottles_in = v_returned
   where reference_type = 'delivery'
     and reference_id = v_delivery_id;

  return coalesce(new, old);
end;
$$;

revoke all on function public.fn_sync_delivery_bottles_to_customer_ledger() from public, anon, authenticated;

drop trigger if exists trg_sync_delivery_bottles_to_customer_ledger on public.delivery_items;
create trigger trg_sync_delivery_bottles_to_customer_ledger
after insert or update or delete
on public.delivery_items
for each row execute function public.fn_sync_delivery_bottles_to_customer_ledger();

-- Repair existing approved delivery ledger rows idempotently.
update public.customer_ledger_entries cle
   set bottles_out = totals.delivered_qty,
       bottles_in = totals.returned_qty
  from (
    select delivery_id,
           coalesce(sum(delivered_qty), 0)::integer as delivered_qty,
           coalesce(sum(returned_qty), 0)::integer as returned_qty
      from public.delivery_items
     group by delivery_id
  ) totals
 where cle.reference_type = 'delivery'
   and cle.reference_id = totals.delivery_id;