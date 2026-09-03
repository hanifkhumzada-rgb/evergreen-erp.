alter table deliveries add column if not exists void_reason text;
alter table deliveries add column if not exists voided_at timestamptz;
alter table deliveries add column if not exists voided_by uuid references profiles(id);

-- New delete-tier permission, separate from deliveries.edit (which riders
-- also hold for their own deliveries) — voiding is a supervisory
-- correction, not a routine edit, so riders don't get it.
insert into permissions (key, module, description) values
  ('deliveries.delete', 'deliveries', 'Void deliveries')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key in ('owner', 'admin', 'manager') and p.key = 'deliveries.delete'
on conflict do nothing;

-- p_deliveries_update (deliveries.edit, rider-scoped) stays as-is for every
-- other column; only the void transition needs deliveries.delete.
create or replace function public.fn_guard_delivery_void_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (new.status = 'void' and old.status is distinct from new.status) or (new.void_reason is distinct from old.void_reason) then
    if auth.uid() is not null and not fn_has_permission('deliveries.delete') then
      raise exception 'permission denied: deliveries.delete required to void a delivery';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_delivery_void on deliveries;
create trigger trg_guard_delivery_void
  before update on deliveries
  for each row execute function fn_guard_delivery_void_columns();

-- Reverses everything createDelivery/record_delivery_completion posted:
-- the bottle_transactions movement(s), the customer_ledger_entries charge,
-- and (inline, not by calling fn_void_payment — voiding a delivery is one
-- permission-gated action, not two) any payment collected on the delivery,
-- identified the same way postDeliveryToLedger tags it: payments.reference
-- = delivery_no, same customer.
--
-- Note: the payment lookup uses a FOR loop (`for pay in select ... limit 1
-- loop ... end loop`), not "SELECT ... INTO pay ... LIMIT 1; IF pay IS NOT
-- NULL" — the latter proved unreliable in testing once the block itself
-- contains further UPDATE/INSERT statements (the SELECT INTO form
-- intermittently failed to populate `pay` even though the identical query
-- via a FOR loop found it every time, verified repeatedly). Keep the FOR
-- loop form for this exact "find one optional related row and act on it"
-- pattern in any future function here.
create or replace function public.fn_void_delivery(p_delivery_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  d record;
  bt record;
  pay record;
  cash_code text;
begin
  if not fn_has_permission('deliveries.delete') then
    raise exception 'permission denied: deliveries.delete required to void a delivery';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required to void a delivery';
  end if;

  select * into d from deliveries where id = p_delivery_id for update;
  if d is null then raise exception 'delivery not found'; end if;
  if d.status = 'void' then raise exception 'this delivery is already voided'; end if;

  -- reverse every bottle movement this delivery posted
  for bt in select * from bottle_transactions where reference_id = p_delivery_id and reference_type in ('delivery', 'delivery_return') loop
    insert into bottle_transactions (txn_date, product_id, quantity, from_state, to_state, customer_id, rider_id, reference_type, reference_id, created_by)
    values (current_date, bt.product_id, bt.quantity, bt.to_state, bt.from_state, bt.customer_id, bt.rider_id, bt.reference_type || '_void', p_delivery_id, auth.uid());
  end loop;

  -- reverse the delivery charge on the customer ledger, if one was posted
  if exists (select 1 from customer_ledger_entries where reference_type = 'delivery' and reference_id = p_delivery_id) then
    insert into customer_ledger_entries (customer_id, entry_date, reference_type, reference_id, description, debit, credit, created_by)
    values (d.customer_id, current_date, 'delivery_void', p_delivery_id, 'VOID: Delivery ' || d.delivery_no || ' — ' || p_reason, 0, d.amount, auth.uid());
  end if;

  -- reverse any payment collected on this delivery
  for pay in select * from payments where customer_id = d.customer_id and reference = d.delivery_no and voided = false limit 1 loop
    update payments set voided = true, void_reason = 'Reversed due to delivery void: ' || p_reason, voided_at = now(), voided_by = auth.uid()
    where id = pay.id;

    insert into customer_ledger_entries (customer_id, entry_date, reference_type, reference_id, description, debit, credit, created_by)
    values (pay.customer_id, current_date, 'payment_void', pay.id, 'VOID: Payment ' || pay.receipt_no || ' (delivery void) — ' || p_reason, pay.amount, 0, auth.uid());

    if pay.cash_account_id is not null then
      insert into cash_transactions (account_id, txn_date, type, amount, reference_type, reference_id, description, created_by)
      values (pay.cash_account_id, current_date, 'adjustment', -pay.amount, 'payment_void', pay.id, 'VOID: Payment ' || pay.receipt_no || ' (delivery void) — ' || p_reason, auth.uid());
    end if;

    cash_code := case when pay.method = 'bank' then '1010' else '1000' end;
    perform post_journal(current_date, pay.receipt_no, 'VOID: Payment received (delivery void) — ' || p_reason, 'payments', pay.id, auth.uid(),
      jsonb_build_array(
        jsonb_build_object('account', '1100', 'debit', pay.amount, 'credit', 0),
        jsonb_build_object('account', cash_code, 'debit', 0, 'credit', pay.amount)
      ));
  end loop;

  update deliveries set status = 'void', void_reason = p_reason, voided_at = now(), voided_by = auth.uid()
  where id = p_delivery_id;
end;
$function$;

grant execute on function public.fn_void_delivery(uuid, text) to authenticated;
