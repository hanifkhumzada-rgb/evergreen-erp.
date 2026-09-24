-- Realistic-volume performance test that NEVER commits.
--
-- Inserts synthetic Evergreen-sized data (300 customers, 6,000 deliveries
-- + items, 6,000 invoices, 3,000 payments, 12,000 bottle transactions and
-- the matching ledger rows) inside one DO block, times the queries the
-- hot pages run as a real staff user under full RLS, then RAISEs so the
-- whole transaction — including every synthetic row — is rolled back.
-- Results come back in the exception message. Safe to run on production.
--
-- :manager_uid — a staff user of the business (default: TEST Manager).
do $$
declare
  biz uuid := '99411dc5-82a4-4ba3-b1d5-5e0e042e096d';
  mgr uuid := 'da746b85-ef70-4dc1-8f4a-0dd08ffc0caf';
  prod uuid := (select id from public.products where business_id = biz order by name limit 1);
  zone uuid := (select id from public.zones where business_id = biz limit 1);
  t0 timestamptz; res jsonb := '{}'::jsonb; j jsonb; n bigint; one_cust uuid;
begin
  -- Skip triggers while bulk-loading (audit/ledger triggers); ledger rows
  -- are inserted explicitly below so balances are realistic.
  set local session_replication_role = replica;

  create temp table _c on commit drop as
    select gen_random_uuid() id, g from generate_series(1, 300) g;
  insert into public.customers(id, code, name, mobile, address, area, zone_id, business_id, customer_type, status, is_active, created_at)
    select id, 'PERF-' || lpad(g::text, 4, '0'), 'Perf Customer ' || g, '0300' || lpad(g::text, 7, '0'),
           'Street ' || g, 'Area ' || (g % 12), zone, biz, 'Home', 'active', true, now() - (g || ' days')::interval
    from _c;

  create temp table _d on commit drop as
    select gen_random_uuid() id, (select id from _c where g = 1 + (s % 300)) customer_id, s,
           (current_date - (s % 180)) d
    from generate_series(1, 6000) s;
  insert into public.deliveries(id, delivery_no, customer_id, delivery_date, status, amount, amount_collected, business_id, delivered_at)
    select id, 'PERF-D-' || s, customer_id, d, 'delivered', 300, case when s % 3 = 0 then 300 else 0 end, biz, d
    from _d;
  insert into public.delivery_items(delivery_id, product_id, expected_qty, delivered_qty, returned_qty, unit_price, business_id)
    select id, prod, 3, 3, 2, 100, biz from _d;
  insert into public.invoices(invoice_no, customer_id, invoice_date, due_date, subtotal, net_amount, status, business_id, delivery_id)
    select 'PERF-I-' || s, customer_id, d, d + 30, 300, 300, 'sent', biz, id from _d;
  insert into public.payments(receipt_no, customer_id, amount, payment_date, method, business_id)
    select 'PERF-R-' || s, customer_id, 200, d, 'cash', biz from _d where s % 2 = 0;
  insert into public.bottle_transactions(txn_date, product_id, quantity, from_state, to_state, customer_id, reference_type, reference_id, business_id)
    select d, prod, 3, 'with_rider'::public.bottle_state, 'with_customer'::public.bottle_state, customer_id, 'delivery', id, biz from _d
    union all
    select d, prod, 2, 'with_customer'::public.bottle_state, 'with_rider'::public.bottle_state, customer_id, 'delivery', id, biz from _d;
  insert into public.customer_ledger_entries(customer_id, entry_date, reference_type, reference_id, description, debit, credit, business_id)
    select customer_id, d, 'delivery', id, 'Delivery PERF-D-' || s, 300, 0, biz from _d
    union all
    select customer_id, d, 'payment', null, 'Payment', 0, 200, biz from _d where s % 2 = 0;
  analyze public.customers; analyze public.deliveries; analyze public.delivery_items; analyze public.invoices;
  analyze public.payments; analyze public.bottle_transactions; analyze public.customer_ledger_entries;

  set local session_replication_role = origin;
  one_cust := (select id from _c where g = 7);

  -- Run each query the way PostgREST does (full json materialisation) as
  -- the staff user under RLS.
  perform set_config('request.jwt.claims', json_build_object('sub', mgr, 'role', 'authenticated')::text, true);
  set local role authenticated;

  t0 := clock_timestamp();
  select count(*) into n from public.customers where is_active;
  res := res || jsonb_build_object('dash_count_active_customers', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', n));

  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (select customer_id, balance from public.v_customer_balance) x;
  res := res || jsonb_build_object('v_customer_balance_all', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j)));

  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (select customer_id, name, balance from public.v_customer_balance where balance > 1000 order by balance desc limit 5) x;
  res := res || jsonb_build_object('dash_top_outstanding', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1)));

  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (select customer_id, product_id, bottles_with_customer from public.v_customer_bottle_balance) x;
  res := res || jsonb_build_object('v_customer_bottle_balance_all', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j)));

  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (
    select c.id, c.code, c.name, c.mobile, c.area, c.zone_id, c.status, c.is_active, c.created_at from public.customers c order by c.created_at desc) x;
  res := res || jsonb_build_object('customers_list_all', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j), 'kb', round(length(j::text) / 1024.0)));

  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (
    select c.id, c.name, c.code from public.customers c where c.name ilike '%customer 12%' or c.mobile ilike '%customer 12%' or c.code ilike '%customer 12%') x;
  res := res || jsonb_build_object('customer_search_ilike', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j)));

  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (
    select d.*, (select json_agg(i) from (select product_id, expected_qty, delivered_qty, returned_qty from public.delivery_items i where i.delivery_id = d.id) i) items
    from public.deliveries d where d.delivery_date >= current_date - 30 order by d.delivery_date desc limit 1000) x;
  res := res || jsonb_build_object('deliveries_history_30d_limit1000', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j), 'kb', round(length(j::text) / 1024.0)));

  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (
    select d.delivery_date, d.status, (select json_agg(i) from (select delivered_qty from public.delivery_items i where i.delivery_id = d.id) i) items
    from public.deliveries d where d.delivery_date between current_date - 6 and current_date) x;
  res := res || jsonb_build_object('dash_deliveries_7d_trend', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j)));

  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (
    select customer_id, due_date from public.invoices where status <> 'paid' and status <> 'void' and due_date is not null) x;
  res := res || jsonb_build_object('dash_overdue_invoices_scan', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j), 'kb', round(length(j::text) / 1024.0)));

  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (
    select net_amount, invoice_date from public.invoices where invoice_date >= current_date - 13 and status <> 'void') x;
  res := res || jsonb_build_object('dash_invoices_14d', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j)));

  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (
    select p.*, (select name from public.customers c where c.id = p.customer_id) cname from public.payments p order by created_at desc limit 200) x;
  res := res || jsonb_build_object('payments_recent_200', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j)));

  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (
    select customer_id, payment_date, amount from public.payments where not voided and payment_date >= current_date - 400) x;
  res := res || jsonb_build_object('payments_400d_scan', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j), 'kb', round(length(j::text) / 1024.0)));

  -- Customer 360 / ledger for one customer (~20 deliveries, ~10 payments)
  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (select * from public.customer_ledger_entries where customer_id = one_cust order by entry_date, created_at) x;
  res := res || jsonb_build_object('ledger_one_customer', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j)));
  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (select balance from public.v_customer_balance where customer_id = one_cust) x;
  res := res || jsonb_build_object('balance_one_customer', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1)));
  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (select * from public.deliveries where customer_id = one_cust order by delivery_date desc) x;
  res := res || jsonb_build_object('deliveries_one_customer', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j)));
  t0 := clock_timestamp();
  select coalesce(json_agg(x), '[]')::jsonb into j from (select * from public.bottle_transactions where customer_id = one_cust order by txn_date desc) x;
  res := res || jsonb_build_object('bottle_txns_one_customer', jsonb_build_object('ms', round(extract(epoch from clock_timestamp() - t0) * 1000, 1), 'rows', jsonb_array_length(j)));

  reset role;
  raise exception 'SCALE_RESULT %', res;
end $$;
