-- fn_audit_trigger fires on 16 tables (customers, invoices, payments,
-- expenses, deliveries, journal_entries/lines, chart_of_accounts,
-- customer_prices, product_prices, bottle_transactions/reconciliations,
-- cash_transactions, orders, profiles, plus the global role_permissions
-- catalog) and inserts one row into audit_logs per change -- but audit_logs
-- is now NOT NULL on business_id and the trigger didn't set it, so every
-- audited insert/update/delete across those 16 tables started failing
-- outright. Caught during Phase 2 verification before it ever reached
-- production data (a plain customers insert failed with this error first).
--
-- Fix: pull business_id off the audited row itself (all 15 of those tables
-- have it) with a fallback to the acting user's own business_id for the one
-- table that doesn't -- role_permissions, a global catalog not scoped to
-- any one business; attributing that audit entry to the editing user's own
-- business is a reasonable call for a foundation-phase fix, not a
-- deliberate design statement about how role changes should be audited
-- once there are multiple real tenants.
create or replace function public.fn_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row jsonb;
  v_record_id text;
  v_business_id uuid;
begin
  v_row := to_jsonb(case when TG_OP = 'DELETE' then old else new end);
  v_record_id := coalesce(
    v_row->>'id',
    (select string_agg(key || '=' || value, ',')
       from jsonb_each_text(v_row)
       where key like '%_id')
  );
  v_business_id := coalesce((v_row->>'business_id')::uuid, fn_current_business_id());
  insert into audit_logs (user_id, action, module, record_id, old_value, new_value, business_id)
  values (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    v_record_id,
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE','INSERT') then to_jsonb(new) else null end,
    v_business_id
  );
  return coalesce(new, old);
end; $function$;
