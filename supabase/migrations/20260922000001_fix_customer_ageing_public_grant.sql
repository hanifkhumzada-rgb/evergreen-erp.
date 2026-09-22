-- Follow-up to 20260922000000_audit_security_definer_gaps.sql: `revoke
-- ... from anon` alone was a no-op for these functions — verified live via
-- has_function_privilege() that anon could still execute fn_customer_ageing
-- after that migration ran. EXECUTE was granted to PUBLIC (Postgres's
-- default on CREATE FUNCTION, preserved across CREATE OR REPLACE), and
-- anon inherits through PUBLIC membership regardless of a role-specific
-- revoke. Revoke from PUBLIC directly and re-grant only to authenticated,
-- which is who legitimately calls these (the ledger page's
-- supabase.rpc("fn_customer_ageing", ...) and the Smart Entry UI).
revoke execute on function public.fn_customer_ageing(uuid, date) from public;
grant execute on function public.fn_customer_ageing(uuid, date) to authenticated;

revoke execute on function public.fn_smart_entry_check(text, jsonb) from public;
grant execute on function public.fn_smart_entry_check(text, jsonb) to authenticated;
revoke execute on function public.fn_smart_entry_create(text, jsonb, text, text) from public;
grant execute on function public.fn_smart_entry_create(text, jsonb, text, text) to authenticated;
revoke execute on function public.fn_smart_entry_approve(uuid) from public;
grant execute on function public.fn_smart_entry_approve(uuid) to authenticated;
revoke execute on function public.fn_smart_entry_reject(uuid, text) from public;
grant execute on function public.fn_smart_entry_reject(uuid, text) to authenticated;
revoke execute on function public.fn_smart_entry_reverse(uuid, text) from public;
grant execute on function public.fn_smart_entry_reverse(uuid, text) to authenticated;
revoke execute on function public.fn_smart_entry_submit(uuid) from public;
grant execute on function public.fn_smart_entry_submit(uuid) to authenticated;
revoke execute on function public.fn_smart_entry_update(uuid, jsonb) from public;
grant execute on function public.fn_smart_entry_update(uuid, jsonb) to authenticated;
revoke execute on function public.fn_smart_entry_delete(uuid, text) from public;
grant execute on function public.fn_smart_entry_delete(uuid, text) to authenticated;
revoke execute on function public.fn_validate_smart_entry(text, jsonb) from public;
grant execute on function public.fn_validate_smart_entry(text, jsonb) to authenticated;
