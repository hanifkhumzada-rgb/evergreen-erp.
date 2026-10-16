create table public.website_order_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default '99411dc5-82a4-4ba3-b1d5-5e0e042e096d'::uuid references public.businesses(id),
  customer_name text not null,
  phone text not null,
  delivery_address text not null,
  bottle_quantity smallint not null default 1,
  note text,
  status text not null default 'pending',
  source text not null default 'website',
  created_at timestamptz not null default now(),
  constraint website_order_requests_name_length check (char_length(btrim(customer_name)) between 2 and 100),
  constraint website_order_requests_phone_length check (char_length(btrim(phone)) between 8 and 20),
  constraint website_order_requests_address_length check (char_length(btrim(delivery_address)) between 4 and 300),
  constraint website_order_requests_bottle_quantity check (bottle_quantity between 1 and 50),
  constraint website_order_requests_note_length check (note is null or char_length(note) <= 500),
  constraint website_order_requests_status check (status in ('pending', 'confirmed', 'rejected', 'converted')),
  constraint website_order_requests_source check (source = 'website')
);

create index website_order_requests_business_status_created_idx
  on public.website_order_requests (business_id, status, created_at desc);

alter table public.website_order_requests enable row level security;

create policy website_order_requests_public_insert
  on public.website_order_requests
  for insert
  to anon
  with check (
    business_id = '99411dc5-82a4-4ba3-b1d5-5e0e042e096d'::uuid
    and status = 'pending'
    and source = 'website'
    and char_length(btrim(customer_name)) between 2 and 100
    and char_length(btrim(phone)) between 8 and 20
    and char_length(btrim(delivery_address)) between 4 and 300
    and bottle_quantity between 1 and 50
    and (note is null or char_length(note) <= 500)
  );

create policy website_order_requests_staff_read
  on public.website_order_requests
  for select
  to authenticated
  using (
    business_id = (select public.fn_current_business_id())
    and (select public.fn_has_permission('orders.view'))
  );

revoke all on public.website_order_requests from public, anon, authenticated;
grant insert (customer_name, phone, delivery_address, bottle_quantity, note)
  on public.website_order_requests to anon;
grant select on public.website_order_requests to authenticated;
