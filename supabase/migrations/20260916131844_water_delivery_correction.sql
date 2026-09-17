create or replace function public.fn_correct_water_delivery(p_id uuid,p_items jsonb,p_reason text)
returns void language plpgsql security invoker set search_path='' as $$
declare d public.deliveries%rowtype; i jsonb; old_item public.delivery_items%rowtype; bal numeric; old_items jsonb;
begin
 if auth.uid() is null or public.fn_current_role_key()<>'owner' then raise exception 'Only the Owner may correct completed deliveries'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Correction reason required'; end if;
 select * into d from public.deliveries where id=p_id and business_id=public.fn_current_business_id() for update;
 if not found then raise exception 'Delivery not found in your business'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Delivery items required'; end if;
 if (select count(*) from jsonb_array_elements(p_items)) <> (select count(distinct x->>'product_id') from jsonb_array_elements(p_items) x) then raise exception 'Duplicate product row'; end if;
 select jsonb_agg(to_jsonb(di)) into old_items from public.delivery_items di where delivery_id=p_id;
 for i in select * from jsonb_array_elements(p_items) loop
  select * into old_item from public.delivery_items where delivery_id=p_id and product_id=(i->>'product_id')::uuid for update;
  if not found then raise exception 'Delivery item not found'; end if;
  if coalesce((i->>'delivered_qty')::integer,0)<=0 or coalesce((i->>'returned_qty')::integer,-1)<0 then raise exception 'Delivered quantity must be positive; returned quantity cannot be negative'; end if;
  select coalesce(sum(bottles_with_customer),0) into bal from public.v_customer_bottle_balance where customer_id=d.customer_id and product_id=old_item.product_id;
  if bal + (i->>'delivered_qty')::integer-coalesce(old_item.delivered_qty,0) - (i->>'returned_qty')::integer+coalesce(old_item.returned_qty,0)<0 then raise exception 'Correction would create a negative customer bottle balance'; end if;
 end loop;
 perform public.fn_correct_delivery_quantities(p_id,p_items,p_reason);
 insert into public.audit_logs(user_id,action,module,record_id,old_value,new_value,business_id)
 values(auth.uid(),'CORRECT','deliveries',p_id::text,jsonb_build_object('items',old_items,'amount',d.amount),
  jsonb_build_object('items',p_items,'reason',btrim(p_reason)),d.business_id);
end $$;
revoke all on function public.fn_correct_water_delivery(uuid,jsonb,text) from public,anon;
grant execute on function public.fn_correct_water_delivery(uuid,jsonb,text) to authenticated;
