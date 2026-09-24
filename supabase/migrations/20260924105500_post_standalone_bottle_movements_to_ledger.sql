-- Post non-delivery customer bottle movements to the customer ledger.
-- Delivery movements remain represented by their delivery ledger row.

create unique index if not exists uq_customer_ledger_bottle_transaction
on public.customer_ledger_entries(reference_id)
where reference_type = 'bottle_transaction';

create or replace function public.fn_sync_bottle_transaction_to_customer_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.bottle_transactions%rowtype;
  v_out integer := 0;
  v_in integer := 0;
begin
  if tg_op = 'DELETE' then
    delete from public.customer_ledger_entries
     where reference_type = 'bottle_transaction' and reference_id = old.id;
    return old;
  end if;
  v_row := new;
  if v_row.customer_id is null or v_row.reference_type = 'delivery' then
    delete from public.customer_ledger_entries
     where reference_type = 'bottle_transaction' and reference_id = v_row.id;
    return new;
  end if;
  if v_row.to_state = 'with_customer' and v_row.from_state <> 'with_customer' then
    v_out := v_row.quantity;
  elsif v_row.from_state = 'with_customer' and v_row.to_state <> 'with_customer' then
    v_in := v_row.quantity;
  end if;
  insert into public.customer_ledger_entries
    (customer_id, entry_date, reference_type, reference_id, description,
     debit, credit, bottles_out, bottles_in, remarks, created_by, business_id)
  values
    (v_row.customer_id, v_row.txn_date, 'bottle_transaction', v_row.id,
     coalesce(nullif(v_row.remarks, ''), 'Bottle movement'),
     0, 0, v_out, v_in, v_row.remarks, v_row.created_by, v_row.business_id)
  on conflict (reference_id) where reference_type = 'bottle_transaction'
  do update set customer_id = excluded.customer_id, entry_date = excluded.entry_date,
    description = excluded.description, bottles_out = excluded.bottles_out,
    bottles_in = excluded.bottles_in, remarks = excluded.remarks,
    business_id = excluded.business_id;
  return new;
end;
$$;

revoke all on function public.fn_sync_bottle_transaction_to_customer_ledger() from public, anon, authenticated;

drop trigger if exists trg_sync_bottle_transaction_to_customer_ledger on public.bottle_transactions;
create trigger trg_sync_bottle_transaction_to_customer_ledger
after insert or update or delete on public.bottle_transactions
for each row execute function public.fn_sync_bottle_transaction_to_customer_ledger();

insert into public.customer_ledger_entries
  (customer_id, entry_date, reference_type, reference_id, description,
   debit, credit, bottles_out, bottles_in, remarks, created_by, business_id)
select bt.customer_id, bt.txn_date, 'bottle_transaction', bt.id,
       coalesce(nullif(bt.remarks, ''), 'Bottle movement'), 0, 0,
       case when bt.to_state = 'with_customer' and bt.from_state <> 'with_customer' then bt.quantity else 0 end,
       case when bt.from_state = 'with_customer' and bt.to_state <> 'with_customer' then bt.quantity else 0 end,
       bt.remarks, bt.created_by, bt.business_id
from public.bottle_transactions bt
where bt.customer_id is not null and bt.reference_type <> 'delivery'
on conflict (reference_id) where reference_type = 'bottle_transaction'
do update set customer_id = excluded.customer_id, entry_date = excluded.entry_date,
  description = excluded.description, bottles_out = excluded.bottles_out,
  bottles_in = excluded.bottles_in, remarks = excluded.remarks,
  business_id = excluded.business_id;