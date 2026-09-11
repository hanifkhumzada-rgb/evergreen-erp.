-- Security-definer functions are privileged API endpoints. Remove the
-- implicit PUBLIC grant (which also reached anon/authenticated) and grant only
-- the small set of RPCs the signed-in ERP actually calls. Server-only portal
-- OTP functions remain available to service_role.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end $$;

grant execute on function public.fn_current_business_id() to authenticated;
grant execute on function public.fn_current_customer_id() to authenticated;
grant execute on function public.fn_current_role_key() to authenticated;
grant execute on function public.fn_get_or_create_bpv_no(text, uuid) to authenticated;
grant execute on function public.fn_has_permission(text) to authenticated;
grant execute on function public.fn_is_owner_admin() to authenticated;
grant execute on function public.fn_next_customer_code() to authenticated;
grant execute on function public.fn_void_delivery(uuid, text) to authenticated;
grant execute on function public.fn_void_expense(uuid, text) to authenticated;
grant execute on function public.fn_void_invoice(uuid, text) to authenticated;
grant execute on function public.fn_void_journal_entry(uuid, text) to authenticated;
grant execute on function public.fn_void_payment(uuid, text) to authenticated;
grant execute on function public.fn_void_production_batch(uuid, text) to authenticated;
grant execute on function public.record_delivery_completion(
  uuid, jsonb, public.delivery_status, numeric, public.payment_method,
  uuid, text, text, text, text
) to authenticated;
grant execute on function public.refresh_alerts() to authenticated;
