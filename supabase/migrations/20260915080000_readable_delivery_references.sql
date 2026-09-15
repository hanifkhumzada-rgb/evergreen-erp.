-- Human-readable delivery references: DEL-DDMMYYYY-CUSTOMERID-SEQUENCE.
-- Existing delivery numbers remain unchanged; only future records use this format.
create or replace function public.fn_next_delivery_no(
  p_customer_id uuid,
  p_delivery_date date default current_date
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer_code text;
  v_customer_part text;
  v_prefix text;
  v_next integer;
begin
  select code into v_customer_code from public.customers where id = p_customer_id;
  if v_customer_code is null then raise exception 'Customer not found for delivery reference'; end if;

  v_customer_part := nullif(regexp_replace(v_customer_code, '[^0-9]', '', 'g'), '');
  if v_customer_part is null then
    v_customer_part := upper(substr(replace(p_customer_id::text, '-', ''), 1, 8));
  end if;

  v_prefix := 'DEL-' || to_char(coalesce(p_delivery_date, current_date), 'DDMMYYYY') || '-' || v_customer_part;
  perform pg_advisory_xact_lock(hashtextextended(v_prefix, 0));

  select coalesce(max(case
    when delivery_no ~ ('^' || v_prefix || '-[0-9]+$')
      then substring(delivery_no from '([0-9]+)$')::integer
    else 0 end), 0) + 1
  into v_next
  from public.deliveries
  where delivery_no like v_prefix || '-%';

  return v_prefix || '-' || lpad(v_next::text, 2, '0');
end;
$$;

revoke all on function public.fn_next_delivery_no(uuid,date) from public, anon;
grant execute on function public.fn_next_delivery_no(uuid,date) to authenticated, service_role;

-- Point the existing Smart Entry posting engine at the same generator without
-- rewriting its large, audited transaction function in two migration files.
do $$
declare
  v_oid oid;
  v_definition text;
  v_updated text;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='fn_post_smart_entry'
  limit 1;

  if v_oid is null then raise exception 'fn_post_smart_entry not found'; end if;
  v_definition := pg_get_functiondef(v_oid);
  v_updated := replace(
    v_definition,
    'v_delivery_no := fn_next_delivery_no();',
    'v_delivery_no := fn_next_delivery_no(v_customer_id, coalesce(nullif(p->>''delivery_date'','''')::date, current_date));'
  );
  if v_updated = v_definition then
    raise exception 'Expected Smart Entry delivery reference call was not found';
  end if;
  execute v_updated;
end;
$$;
