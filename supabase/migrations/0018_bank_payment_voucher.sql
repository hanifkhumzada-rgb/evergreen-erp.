-- Sequential Bank Payment Voucher numbers (BPV-00001, BPV-00002, ...),
-- generated through the same business_settings prefix/counter mechanism
-- already used for invoice/receipt/delivery/order numbers (fn_next_number),
-- rather than a one-off Postgres sequence — this is a document number like
-- those, not a permanent record identifier like the customer code.
alter table business_settings add column if not exists bpv_prefix text not null default 'BPV-';
alter table business_settings add column if not exists next_bpv_number integer not null default 1;

-- A voucher number is only ever needed for bank-method expenses/payments,
-- and most rows in these tables never become one — so it's assigned lazily
-- (see fn_get_or_create_bpv_no below) into a nullable column, not stamped
-- on every row at insert time.
alter table payments add column if not exists bpv_no text;
alter table expenses add column if not exists bpv_no text;

create or replace function public.fn_next_bpv_no()
returns text
language sql
set search_path to 'public'
as $function$
  select fn_next_number('bpv_prefix', 'next_bpv_number');
$function$;

grant execute on function public.fn_next_bpv_no() to authenticated;

-- Returns the Bank Payment Voucher number for a given expense/payment,
-- assigning and persisting one on first request so re-downloading the same
-- voucher always returns the same number instead of consuming a fresh one
-- from the sequence on every PDF request. SECURITY DEFINER because the
-- payments/expenses UPDATE policies don't grant plain viewers write access
-- (payments' only UPDATE policy is gated on payments.delete, for voiding) —
-- so the view-permission check below is the real authorization boundary,
-- same pattern as inviteUser/deleteUser going through the admin client.
create or replace function public.fn_get_or_create_bpv_no(p_module text, p_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_no text;
begin
  if p_module = 'expenses' then
    if not fn_has_permission('expenses.view') then
      raise exception 'permission denied: expenses.view required';
    end if;
    select bpv_no into v_no from expenses where id = p_id;
    if v_no is null then
      v_no := fn_next_bpv_no();
      update expenses set bpv_no = v_no where id = p_id;
    end if;
  elsif p_module = 'payments' then
    if not fn_has_permission('payments.view') then
      raise exception 'permission denied: payments.view required';
    end if;
    select bpv_no into v_no from payments where id = p_id;
    if v_no is null then
      v_no := fn_next_bpv_no();
      update payments set bpv_no = v_no where id = p_id;
    end if;
  else
    raise exception 'unknown module: %', p_module;
  end if;
  return v_no;
end;
$function$;

grant execute on function public.fn_get_or_create_bpv_no(text, uuid) to authenticated;
