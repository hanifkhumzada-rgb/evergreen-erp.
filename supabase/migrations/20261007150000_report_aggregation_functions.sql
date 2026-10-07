-- Interactive Report Viewer — SQL-side aggregation + supporting indexes.
-- ADDITIVE ONLY: new functions and indexes; no table/column changes, no data
-- changes. All functions are SECURITY INVOKER, so every row they read still
-- goes through the caller's RLS policies (business isolation, rider limits).

-- Outstanding receivables per customer (ledger = single source of truth),
-- with last payment and first-debit date for ageing.
create or replace function public.fn_report_outstanding()
returns table (
  customer_id uuid, code text, name text, mobile text, zone_id uuid,
  balance numeric, last_payment_date date, last_payment_amount numeric,
  first_debit_date date, last_activity date
)
language sql stable security invoker set search_path = public
as $$
  with led as (
    select l.customer_id,
           sum(l.debit - l.credit) as bal,
           min(l.entry_date) filter (where l.debit > 0) as first_debit,
           max(l.entry_date) as last_act
    from public.customer_ledger_entries l
    group by l.customer_id
  ), lp as (
    select distinct on (p.customer_id) p.customer_id, p.payment_date, p.amount
    from public.payments p
    where not coalesce(p.voided, false)
    order by p.customer_id, p.payment_date desc, p.created_at desc
  )
  select c.id, c.code, c.name, c.mobile, c.zone_id,
         coalesce(led.bal, 0), lp.payment_date, lp.amount, led.first_debit, led.last_act
  from public.customers c
  left join led on led.customer_id = c.id
  left join lp on lp.customer_id = c.id
  where coalesce(led.bal, 0) <> 0;
$$;

-- Bottle movement per customer for a period + balance as at period end.
create or replace function public.fn_report_bottles(p_from date default null, p_to date default null)
returns table (
  customer_id uuid, code text, name text, zone_id uuid, bottle_limit integer,
  issued bigint, returned bigint, adjustment bigint, balance bigint, last_activity date
)
language sql stable security invoker set search_path = public
as $$
  with t as (
    select bt.customer_id, bt.txn_date, bt.quantity, bt.from_state, bt.to_state
    from public.bottle_transactions bt
    where bt.customer_id is not null
      and (p_to is null or bt.txn_date <= p_to)
  ), agg as (
    select customer_id,
      coalesce(sum(quantity) filter (where to_state = 'with_customer' and from_state not in ('adjustment','lost','damaged')
        and (p_from is null or txn_date >= p_from)), 0) as issued,
      coalesce(sum(quantity) filter (where from_state = 'with_customer' and to_state not in ('adjustment','lost','damaged')
        and (p_from is null or txn_date >= p_from)), 0) as returned,
      coalesce(sum(case when to_state = 'with_customer' and from_state in ('adjustment','lost','damaged') then quantity
                        when from_state = 'with_customer' and to_state in ('adjustment','lost','damaged') then -quantity else 0 end)
        filter (where p_from is null or txn_date >= p_from), 0) as adjustment,
      coalesce(sum(case when to_state = 'with_customer' then quantity when from_state = 'with_customer' then -quantity else 0 end), 0) as balance,
      max(txn_date) as last_activity
    from t group by customer_id
  )
  select c.id, c.code, c.name, c.zone_id, c.bottle_limit,
         agg.issued::bigint, agg.returned::bigint, agg.adjustment::bigint, agg.balance::bigint, agg.last_activity
  from agg join public.customers c on c.id = agg.customer_id;
$$;

-- Inventory movement per item for a period. Movements are stored signed
-- (stock-out negative) — the same convention v_inventory_stock sums.
create or replace function public.fn_report_inventory(p_from date default null, p_to date default null)
returns table (
  item_id uuid, name text, category text, unit text, reorder_level integer,
  opening numeric, stock_in numeric, stock_out numeric, adjustment numeric, closing numeric, last_movement timestamptz
)
language sql stable security invoker set search_path = public
as $$
  select i.id, i.name, i.category, i.unit, i.reorder_level,
    coalesce(sum(m.quantity) filter (where p_from is not null and m.created_at::date < p_from), 0) as opening,
    coalesce(sum(m.quantity) filter (where m.movement_type <> 'adjustment' and m.quantity > 0
      and (p_from is null or m.created_at::date >= p_from)), 0) as stock_in,
    coalesce(-sum(m.quantity) filter (where m.movement_type <> 'adjustment' and m.quantity < 0
      and (p_from is null or m.created_at::date >= p_from)), 0) as stock_out,
    coalesce(sum(m.quantity) filter (where m.movement_type = 'adjustment'
      and (p_from is null or m.created_at::date >= p_from)), 0) as adjustment,
    coalesce(sum(m.quantity), 0) as closing,
    max(m.created_at) as last_movement
  from public.inventory_items i
  left join public.inventory_movements m
    on m.item_id = i.id and (p_to is null or m.created_at::date <= p_to)
  group by i.id, i.name, i.category, i.unit, i.reorder_level;
$$;

revoke execute on function public.fn_report_outstanding() from public, anon;
revoke execute on function public.fn_report_bottles(date, date) from public, anon;
revoke execute on function public.fn_report_inventory(date, date) from public, anon;
grant execute on function public.fn_report_outstanding() to authenticated;
grant execute on function public.fn_report_bottles(date, date) to authenticated;
grant execute on function public.fn_report_inventory(date, date) to authenticated;

-- Indexes for report filters (date, customer, zone, status).
create index if not exists idx_ledger_customer_date on public.customer_ledger_entries(customer_id, entry_date, created_at);
create index if not exists idx_payments_customer_date on public.payments(customer_id, payment_date);
create index if not exists idx_payments_reference on public.payments(reference) where reference is not null;
create index if not exists idx_invoices_customer_date on public.invoices(customer_id, invoice_date);
create index if not exists idx_invoices_status_date on public.invoices(status, invoice_date);
create index if not exists idx_deliveries_customer_date on public.deliveries(customer_id, delivery_date);
create index if not exists idx_deliveries_rider_date on public.deliveries(rider_id, delivery_date);
create index if not exists idx_expenses_category_date on public.expenses(category_id, expense_date);
create index if not exists idx_bottle_txn_customer_date on public.bottle_transactions(customer_id, txn_date);
create index if not exists idx_inventory_movements_item_created on public.inventory_movements(item_id, created_at);
create index if not exists idx_customers_zone on public.customers(zone_id);
create index if not exists idx_audit_logs_record on public.audit_logs(record_id);
