-- record_delivery_completion (the RPC behind markDelivered) had no
-- idempotency guard at all — unlike createDelivery (a 20-second app-level
-- duplicate check) and createPayment (same, added alongside this fix), a
-- double-tap of the "Deliver" button or a retried network request for the
-- SAME already-pending delivery would re-run this function twice: two
-- bottle_transactions rows (double bottles marked with the customer), two
-- customer_ledger_entries debits, and a second payments row for the same
-- cash collection. Caught while verifying Phase 5's "double-submit never
-- creates a duplicate transaction" requirement for real.
--
-- Fix: the function already takes `select ... for update` on the delivery
-- row, which serializes any concurrent call for the same delivery_id — a
-- second call now simply blocks until the first commits, then sees the
-- already-updated status and returns as a no-op instead of re-posting
-- everything a second time. This RPC has exactly one caller
-- (markDelivered, only ever invoked on a still-'pending' delivery), so
-- treating 'delivered'/'partially_delivered' as "already completed,
-- nothing to do" is safe — it's never used to re-edit a completed one
-- (that's a separate, distinct correction workflow).
create or replace function public.record_delivery_completion(
  p_delivery_id uuid, p_items jsonb, p_status delivery_status,
  p_amount_collected numeric default 0, p_payment_method payment_method default null,
  p_cash_account_id uuid default null, p_rider_remarks text default null,
  p_customer_remarks text default null, p_proof_photo_url text default null, p_signature_url text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_delivery deliveries%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_delivered integer;
  v_returned integer;
  v_unit_price numeric;
  v_total numeric := 0;
  v_receipt_no text;
begin
  if not fn_has_permission('deliveries.edit') then
    raise exception 'permission denied: deliveries.edit required';
  end if;

  select * into v_delivery from deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'Delivery % not found', p_delivery_id;
  end if;

  -- Idempotency: already completed by an earlier (possibly concurrent)
  -- call — a no-op, not an error, so a double-tap feels like success.
  if v_delivery.status in ('delivered', 'partially_delivered') then
    return;
  end if;

  -- riders may only complete their own assigned deliveries, mirroring the RLS
  -- restriction on the deliveries table itself
  if fn_current_role_key() = 'rider' and v_delivery.rider_id is distinct from auth.uid() then
    raise exception 'permission denied: not your delivery';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_delivered := coalesce((v_item->>'delivered_qty')::integer, 0);
    v_returned := coalesce((v_item->>'returned_qty')::integer, 0);
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);

    update delivery_items
      set delivered_qty = v_delivered, returned_qty = v_returned, unit_price = v_unit_price
      where delivery_id = p_delivery_id and product_id = v_product_id;

    if v_delivered > 0 then
      insert into bottle_transactions (txn_date, product_id, quantity, from_state, to_state, customer_id, rider_id, reference_type, reference_id, created_by)
      values (v_delivery.delivery_date, v_product_id, v_delivered, 'with_rider', 'with_customer', v_delivery.customer_id, v_delivery.rider_id, 'delivery', p_delivery_id, auth.uid());
    end if;
    if v_returned > 0 then
      insert into bottle_transactions (txn_date, product_id, quantity, from_state, to_state, customer_id, rider_id, reference_type, reference_id, created_by)
      values (v_delivery.delivery_date, v_product_id, v_returned, 'with_customer', 'with_rider', v_delivery.customer_id, v_delivery.rider_id, 'delivery_return', p_delivery_id, auth.uid());
    end if;
    v_total := v_total + (v_delivered * v_unit_price);
  end loop;

  update deliveries set
    status = p_status,
    amount = v_total,
    amount_collected = p_amount_collected,
    payment_method = p_payment_method,
    rider_remarks = coalesce(p_rider_remarks, rider_remarks),
    customer_remarks = coalesce(p_customer_remarks, customer_remarks),
    proof_photo_url = coalesce(p_proof_photo_url, proof_photo_url),
    signature_url = coalesce(p_signature_url, signature_url),
    delivered_at = case when p_status in ('delivered','partially_delivered') then now() else delivered_at end
  where id = p_delivery_id;

  if v_total > 0 and p_status in ('delivered','partially_delivered') then
    insert into customer_ledger_entries (customer_id, entry_date, reference_type, reference_id, description, debit, credit, created_by)
    values (v_delivery.customer_id, v_delivery.delivery_date, 'delivery', p_delivery_id, 'Delivery ' || v_delivery.delivery_no, v_total, 0, auth.uid());
  end if;

  if p_amount_collected > 0 then
    v_receipt_no := fn_next_receipt_no();
    insert into payments (receipt_no, customer_id, amount, payment_date, method, cash_account_id, reference, received_by, notes)
    values (v_receipt_no, v_delivery.customer_id, p_amount_collected, v_delivery.delivery_date,
            coalesce(p_payment_method,'cash'), p_cash_account_id, v_delivery.delivery_no, auth.uid(), 'Collected on delivery ' || v_delivery.delivery_no);
  end if;
end;
$function$;
