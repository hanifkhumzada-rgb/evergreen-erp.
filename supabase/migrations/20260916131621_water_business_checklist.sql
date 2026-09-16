-- Additive customer field; no existing values rewritten.
alter table public.customers add column if not exists building text;

-- Normal and bulk delivery use the same all-or-nothing posting boundary.
create or replace function public.fn_record_water_delivery(
 p_customer_id uuid, p_product_id uuid, p_delivery_date date,
 p_delivered_qty integer, p_returned_qty integer, p_cash_collected numeric,
 p_rider_id uuid, p_request_id text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
 v_business uuid := public.fn_current_business_id();
 v_actor uuid := auth.uid();
 v_customer public.customers%rowtype;
 v_id uuid;
 v_no text;
 v_rate numeric;
 v_balance numeric;
 v_cash uuid;
begin
 if v_actor is null or v_business is null then raise exception 'Authentication and business assignment required'; end if;
 if not public.fn_has_permission('deliveries.create') or not public.fn_has_permission('deliveries.edit') then raise exception 'Delivery create/edit permission required'; end if;
 if p_delivery_date is null or p_delivered_qty is null or p_delivered_qty <= 0 or p_returned_qty is null or p_returned_qty < 0 or p_cash_collected is null or p_cash_collected < 0 then raise exception 'Date and valid positive delivered quantity are required; returns and cash cannot be negative'; end if;
 if p_rider_id is null or nullif(btrim(p_request_id),'') is null then raise exception 'Delivery boy and submission reference required'; end if;
 -- Stable lock serializes retries and same-customer bottle balance checks.
 perform pg_advisory_xact_lock(hashtextextended(v_business::text || ':' || p_customer_id::text,0));
 select id into v_id from public.deliveries where business_id=v_business and request_id=p_request_id;
 if found then return v_id; end if;
 select * into v_customer from public.customers where id=p_customer_id and business_id=v_business for update;
 if not found then raise exception 'Customer not found in your business'; end if;
 if not v_customer.is_active and public.fn_current_role_key() <> 'owner' then raise exception 'Inactive customer requires Owner approval'; end if;
 if not exists(select 1 from public.products where id=p_product_id and is_active) then raise exception 'Select an active product'; end if;
 if not exists(select 1 from public.profiles where id=p_rider_id and business_id=v_business and is_active) then raise exception 'Delivery boy is not active in your business'; end if;
 if public.fn_current_role_key()='rider' and (p_rider_id<>v_actor or v_customer.assigned_rider_id is distinct from v_actor) then raise exception 'Only your assigned customers may be delivered'; end if;
 select price into v_rate from public.customer_prices where customer_id=p_customer_id and product_id=p_product_id
  and effective_from<=p_delivery_date and (effective_to is null or effective_to>=p_delivery_date)
  order by effective_from desc,created_at desc limit 1;
 if v_rate is null then
  select price into v_rate from public.product_prices where product_id=p_product_id
   and effective_from<=p_delivery_date and (effective_to is null or effective_to>=p_delivery_date)
   order by effective_from desc,created_at desc limit 1;
 end if;
 if v_rate is null or v_rate<=0 then raise exception 'A positive customer/product rate is required'; end if;
 select coalesce(sum(bottles_with_customer),0) into v_balance from public.v_customer_bottle_balance
  where customer_id=p_customer_id and product_id=p_product_id;
 if p_returned_qty>v_balance+p_delivered_qty then raise exception 'Empty return exceeds the customer bottle balance'; end if;
 select id,delivery_no into v_id,v_no from public.deliveries where customer_id=p_customer_id and business_id=v_business
  and delivery_date=p_delivery_date and status='pending' order by created_at desc limit 1 for update;
 if v_id is null then
  v_no := public.fn_next_delivery_no(p_customer_id,p_delivery_date);
  insert into public.deliveries(delivery_no,business_id,customer_id,rider_id,delivery_date,status,created_by,request_id)
   values(v_no,v_business,p_customer_id,p_rider_id,p_delivery_date,'pending',v_actor,p_request_id) returning id into v_id;
 else
  update public.deliveries set rider_id=p_rider_id,request_id=p_request_id where id=v_id;
 end if;
 if exists(select 1 from public.delivery_items where delivery_id=v_id and product_id=p_product_id) then
  update public.delivery_items set expected_qty=p_delivered_qty where delivery_id=v_id and product_id=p_product_id;
 else
  insert into public.delivery_items(delivery_id,product_id,expected_qty,delivered_qty,returned_qty,unit_price)
   values(v_id,p_product_id,p_delivered_qty,0,0,v_rate);
 end if;
 select id into v_cash from public.cash_accounts where type='cash' and is_active order by created_at limit 1;
 perform public.record_delivery_completion(v_id,jsonb_build_array(jsonb_build_object(
  'product_id',p_product_id,'delivered_qty',p_delivered_qty,'returned_qty',p_returned_qty,'unit_price',v_rate)),
  'delivered'::public.delivery_status,p_cash_collected,'cash'::public.payment_method,v_cash);
 insert into public.audit_logs(user_id,action,module,record_id,new_value,business_id)
  values(v_actor,'CREATE','deliveries',v_id::text,jsonb_build_object('reference',v_no,'request_id',p_request_id),v_business);
 return v_id;
end $$;
revoke all on function public.fn_record_water_delivery(uuid,uuid,date,integer,integer,numeric,uuid,text) from public,anon;
grant execute on function public.fn_record_water_delivery(uuid,uuid,date,integer,integer,numeric,uuid,text) to authenticated;

-- Posted expense correction reverses the old record and inserts a linked,
-- pending replacement within one transaction. Never overwrite booked money.
create or replace function public.fn_correct_water_expense(
 p_id uuid,p_category_id uuid,p_date date,p_amount numeric,p_method text,
 p_description text,p_receipt text,p_reason text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare e public.expenses%rowtype; v_id uuid; v_actor uuid:=auth.uid(); v_business uuid:=public.fn_current_business_id();
begin
 if v_actor is null or public.fn_current_role_key()<>'owner' then raise exception 'Only the Owner may correct expenses'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Correction reason required'; end if;
 if p_date is null or p_amount is null or p_amount<=0 or p_method not in ('cash','bank') then raise exception 'Valid date, positive amount and payment method required'; end if;
 if not exists(select 1 from public.expense_categories where id=p_category_id) then raise exception 'Category required'; end if;
 select * into e from public.expenses where id=p_id and business_id=v_business for update;
 if not found then raise exception 'Expense not found'; end if;
 if e.voided or e.status='void' then raise exception 'Expense already voided or corrected'; end if;
 perform public.fn_void_expense(p_id,btrim(p_reason));
 insert into public.expenses(expense_no,category_id,description,amount,expense_date,payment_method,status,
  submitted_by,created_by,receipt_reference,business_id,cash_account_id,employee_id,zone_id,vehicle_id)
 values('EXP-COR-'||replace(gen_random_uuid()::text,'-',''),p_category_id,p_description,p_amount,p_date,
  p_method::public.payment_method,'submitted',v_actor,v_actor,p_receipt,v_business,e.cash_account_id,e.employee_id,e.zone_id,e.vehicle_id)
 returning id into v_id;
 insert into public.audit_logs(user_id,action,module,record_id,old_value,new_value,business_id)
 values(v_actor,'CORRECT','expenses',p_id::text,to_jsonb(e),jsonb_build_object('replacement_id',v_id,'reason',btrim(p_reason)),v_business);
 return v_id;
end $$;
revoke all on function public.fn_correct_water_expense(uuid,uuid,date,numeric,text,text,text,text) from public,anon;
grant execute on function public.fn_correct_water_expense(uuid,uuid,date,numeric,text,text,text,text) to authenticated;
