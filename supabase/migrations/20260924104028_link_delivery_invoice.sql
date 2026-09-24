-- Link each completed delivery to one informational invoice without charging the
-- customer ledger twice. The delivery remains the source of the receivable;
-- the generated invoice is the printable/customer-portal document.

alter table public.invoices
  add column if not exists delivery_id uuid references public.deliveries(id) on delete restrict;

create unique index if not exists invoices_delivery_id_unique
  on public.invoices(delivery_id)
  where delivery_id is not null;

-- Journal posting must remain reliable for approved server-side jobs and
-- backfills where there is no browser JWT to stamp business_id automatically.
create or replace function public.post_journal(
  p_date date,
  p_reference text,
  p_description text,
  p_source_module text,
  p_source_id uuid,
  p_created_by uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  jid uuid;
  ln jsonb;
  acc_id uuid;
  v_business_id uuid;
begin
  select business_id into v_business_id
  from public.profiles
  where id = p_created_by;

  if v_business_id is null then
    raise exception 'Journal creator is not assigned to a business';
  end if;

  insert into public.journal_entries
    (entry_no, entry_date, reference, description, source_module, source_id, created_by, business_id)
  values
    (public.fn_next_journal_no(), p_date, p_reference, p_description,
     p_source_module, p_source_id, p_created_by, v_business_id)
  returning id into jid;

  for ln in select * from jsonb_array_elements(p_lines) loop
    select id into acc_id
    from public.chart_of_accounts
    where business_id = v_business_id and code = (ln->>'account')
    limit 1;
    if acc_id is null then
      raise exception 'Unknown account code: %', ln->>'account';
    end if;
    insert into public.journal_lines
      (journal_id, account_id, debit, credit, business_id)
    values
      (jid, acc_id, coalesce((ln->>'debit')::numeric,0),
       coalesce((ln->>'credit')::numeric,0), v_business_id);
  end loop;

  return jid;
end;
$$;

create or replace function public.fn_post_invoice_to_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A delivery-generated invoice documents a receivable already posted by the
  -- delivery. Manual invoices/adjustments continue to post normally.
  if new.delivery_id is not null then
    return new;
  end if;

  if new.status <> 'draft' and (tg_op = 'INSERT' or old.status = 'draft') then
    if not exists (
      select 1 from public.customer_ledger_entries
      where reference_type = 'invoice' and reference_id = new.id
    ) then
      insert into public.customer_ledger_entries
        (customer_id, entry_date, reference_type, reference_id, description, debit, credit, created_by)
      values
        (new.customer_id, new.invoice_date, 'invoice', new.id,
         'Invoice ' || new.invoice_no, new.net_amount, 0, new.created_by);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.fn_ensure_delivery_invoice(p_delivery_id uuid, p_actor uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_invoice_id uuid;
  v_total numeric;
begin
  select * into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found or v_delivery.status not in ('delivered','partially_delivered') then
    return null;
  end if;

  select id into v_invoice_id
  from public.invoices
  where delivery_id = p_delivery_id;
  if found then
    return v_invoice_id;
  end if;

  select coalesce(sum(delivered_qty * unit_price),0)
  into v_total
  from public.delivery_items
  where delivery_id = p_delivery_id and delivered_qty > 0;

  if v_total <= 0 then
    return null;
  end if;

  insert into public.invoices
    (business_id, invoice_no, customer_id, delivery_id, invoice_date,
     subtotal, discount, tax, net_amount, status, created_by)
  values
    (v_delivery.business_id, public.fn_next_invoice_no(), v_delivery.customer_id,
     v_delivery.id, v_delivery.delivery_date, v_total, 0, 0, v_total, 'sent', p_actor)
  returning id into v_invoice_id;

  insert into public.invoice_items
    (business_id, invoice_id, product_id, description, quantity, rate, discount)
  select
    v_delivery.business_id, v_invoice_id, di.product_id,
    coalesce(p.name,'Water delivery'), di.delivered_qty, di.unit_price, 0
  from public.delivery_items di
  left join public.products p on p.id = di.product_id
  where di.delivery_id = p_delivery_id and di.delivered_qty > 0;

  return v_invoice_id;
end;
$$;

revoke all on function public.fn_ensure_delivery_invoice(uuid,uuid) from public, anon, authenticated;

create or replace function public.fn_invoice_after_delivery_item()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.fn_ensure_delivery_invoice(new.delivery_id, coalesce(auth.uid(), new.business_id));
  return new;
end;
$$;

create or replace function public.fn_invoice_after_delivery_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('delivered','partially_delivered')
     and old.status is distinct from new.status then
    perform public.fn_ensure_delivery_invoice(new.id, coalesce(auth.uid(), new.created_by));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_delivery_item_ensure_invoice on public.delivery_items;
create trigger trg_delivery_item_ensure_invoice
after insert or update of delivered_qty, unit_price on public.delivery_items
for each row execute function public.fn_invoice_after_delivery_item();

drop trigger if exists trg_delivery_status_ensure_invoice on public.deliveries;
create trigger trg_delivery_status_ensure_invoice
after update of status on public.deliveries
for each row execute function public.fn_invoice_after_delivery_status();

-- Safe, idempotent backfill for completed deliveries that predate this change.
do $$
declare r record;
begin
  for r in
    select id, created_by from public.deliveries
    where status in ('delivered','partially_delivered')
  loop
    perform public.fn_ensure_delivery_invoice(r.id, r.created_by);
  end loop;
end;
$$;
