-- Smart Auto-Complete 2.0: fast tenant-safe customer suggestions.
-- SECURITY INVOKER preserves all existing customer RLS policies.

create extension if not exists pg_trgm with schema public;

create index if not exists idx_customers_search_trgm
  on public.customers using gin (
    lower(
      coalesce(code, '') || ' ' || coalesce(name, '') || ' ' ||
      coalesce(mobile, '') || ' ' || coalesce(building, '') || ' ' ||
      coalesce(address, '') || ' ' || coalesce(area, '')
    ) public.gin_trgm_ops
  );

create index if not exists idx_customers_phone_digits
  on public.customers (right(regexp_replace(coalesce(mobile, ''), '\D', '', 'g'), 10));

create or replace function public.fn_customer_autocomplete(p_query text, p_limit integer default 12)
returns table (
  id uuid,
  code text,
  name text,
  mobile text,
  building text,
  address text,
  area text,
  zone_id uuid,
  zone_name text,
  route text,
  default_product_id uuid,
  payment_frequency text,
  regular_qty numeric,
  is_active boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with input as (
    select lower(btrim(coalesce(p_query, ''))) as q,
           regexp_replace(coalesce(p_query, ''), '\D', '', 'g') as digits
  )
  select c.id, c.code, c.name, c.mobile, c.building, c.address, c.area,
         c.zone_id, z.name as zone_name, c.route, c.default_product_id,
         c.payment_frequency, c.regular_qty::numeric, c.is_active
  from public.customers c
  left join public.zones z on z.id = c.zone_id
  cross join input i
  where i.q <> ''
    and (
      lower(coalesce(c.code, '')) = i.q
      or (length(i.digits) >= 4 and regexp_replace(coalesce(c.mobile, ''), '\D', '', 'g') like '%' || i.digits || '%')
      or lower(coalesce(c.code, '')) like i.q || '%'
      or lower(
        coalesce(c.name, '') || ' ' || coalesce(c.building, '') || ' ' ||
        coalesce(c.address, '') || ' ' || coalesce(c.area, '')
      ) like '%' || i.q || '%'
      or lower(coalesce(c.name, '')) % i.q
    )
  order by
    case
      when lower(coalesce(c.code, '')) = i.q then 0
      when regexp_replace(coalesce(c.mobile, ''), '\D', '', 'g') = i.digits and i.digits <> '' then 1
      when lower(coalesce(c.code, '')) like i.q || '%' then 2
      when lower(coalesce(c.name, '')) like i.q || '%' then 3
      else 4
    end,
    greatest(similarity(lower(coalesce(c.name, '')), i.q), similarity(lower(coalesce(c.address, '')), i.q)) desc,
    c.name
  limit least(greatest(coalesce(p_limit, 12), 1), 20);
$$;

revoke all on function public.fn_customer_autocomplete(text, integer) from public, anon;
grant execute on function public.fn_customer_autocomplete(text, integer) to authenticated;
