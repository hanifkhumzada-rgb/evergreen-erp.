-- Permanent, never-reused, monotonically increasing customer IDs in the
-- EW-0001 format, replacing the old timestamp+random CUST- codes. A real
-- Postgres sequence (not a MAX(code)+1 scan) so two concurrent inserts can
-- never collide, and numbers are never reused even if a customer is later
-- deleted.
create sequence if not exists customer_code_seq start 1 increment 1;

create or replace function public.fn_next_customer_code()
returns text
language sql
security definer
set search_path to 'public'
as $function$
  select 'EW-' || lpad(nextval('customer_code_seq')::text, 4, '0');
$function$;

grant execute on function public.fn_next_customer_code() to authenticated;

-- Backfill existing customers with the new format, in creation order, so
-- the earliest customers keep the lowest numbers.
do $$
declare
  r record;
begin
  for r in (select id from customers order by created_at asc, id asc) loop
    update customers set code = fn_next_customer_code() where id = r.id;
  end loop;
end $$;
