-- Multi-tenant foundation, step 2b: the two helper functions everything
-- downstream (triggers, RLS policies) depends on. Runs after business_id
-- columns exist (they reference profiles.business_id) but before backfill —
-- fn_current_business_id will return null for everyone until the backfill
-- in the next step runs, which is fine since nothing calls it yet.
create or replace function public.fn_current_business_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select business_id from profiles where id = auth.uid();
$function$;

grant execute on function public.fn_current_business_id() to authenticated, anon;

-- Generic BEFORE INSERT trigger, attached to every tenant table in a later
-- step: fills business_id from the inserting user's own profile when the
-- app code doesn't set it explicitly (true for every existing insert call
-- site except the few going through the service-role admin client — those
-- are fixed individually in app code, see app/actions.js).
create or replace function public.fn_stamp_business_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.business_id is null then
    new.business_id := fn_current_business_id();
  end if;
  return new;
end;
$function$;

grant execute on function public.fn_stamp_business_id() to authenticated;
