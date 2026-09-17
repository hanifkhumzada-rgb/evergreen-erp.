-- Performance fix — no security/behavior change. `fn_current_business_id()`
-- and `fn_current_customer_id()` (both `stable`) are called bare inside
-- RLS USING/WITH CHECK clauses across ~40 tables (migrations 0021, 0025,
-- 0028, 0031-0033). Postgres can only cache a stable function's result
-- for the duration of a query (via an InitPlan) when it appears wrapped
-- in a scalar subquery — `(select fn_current_business_id())` — not when
-- it's called directly. Called bare, both are SECURITY DEFINER functions
-- that each run their own `select ... from profiles`/`customer_portal_users
-- where id = auth.uid()` lookup, so every multi-row query against a
-- tenant-scoped table was re-running that lookup once per row scanned —
-- confirmed live via pg_policies and flagged by the same class of issue
-- Supabase's own advisor reports as `auth_rls_initplan` for direct
-- `auth.uid()` calls (this doesn't trip that specific lint because the
-- pattern-match doesn't cover custom function names, but it's the same
-- defect, and more expensive since it's a table lookup, not a JWT read).
--
-- This migration rewrites every affected policy to wrap the call in
-- `(select ...)` instead of hand-listing all ~40 tables (new
-- business-isolation policies keep getting added by later migrations —
-- 0028, 0031, 0032, 0033 already did after 0025 shipped this pattern), so
-- it will also catch any such policy this migration itself doesn't know
-- about by name. The boolean predicate is byte-for-byte identical either
-- way — only the planner's ability to cache it changes.
do $$
declare
  pol record;
  new_qual text;
  new_check text;
  sql text;
begin
  for pol in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~ 'fn_current_(business|customer)_id\(\)'
        or coalesce(with_check, '') ~ 'fn_current_(business|customer)_id\(\)'
      )
      -- Skip anything already wrapped (idempotent if this migration is
      -- ever re-run against a database that already has the fix).
      and coalesce(qual, '') !~ '\(select public\.fn_current_(business|customer)_id\(\)\)'
      and coalesce(with_check, '') !~ '\(select public\.fn_current_(business|customer)_id\(\)\)'
  loop
    new_qual := pol.qual;
    new_check := pol.with_check;

    if new_qual is not null then
      new_qual := regexp_replace(new_qual, 'fn_current_business_id\(\)', '(select public.fn_current_business_id())', 'g');
      new_qual := regexp_replace(new_qual, 'fn_current_customer_id\(\)', '(select public.fn_current_customer_id())', 'g');
    end if;
    if new_check is not null then
      new_check := regexp_replace(new_check, 'fn_current_business_id\(\)', '(select public.fn_current_business_id())', 'g');
      new_check := regexp_replace(new_check, 'fn_current_customer_id\(\)', '(select public.fn_current_customer_id())', 'g');
    end if;

    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);

    sql := format(
      'create policy %I on public.%I as %s for %s to %s',
      pol.policyname, pol.tablename,
      case when pol.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      pol.cmd,
      array_to_string(pol.roles, ', ')
    );
    if new_qual is not null then
      sql := sql || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      sql := sql || format(' with check (%s)', new_check);
    end if;

    execute sql;
  end loop;
end $$;

-- Two Customer Portal tables (migration 0033) shipped after the
-- systematic business_id-indexing sweep (migration 0024) and were missed
-- by it — each already had its customer_id lookup indexed, but the
-- restrictive business-isolation policy this migration just rewrote
-- still filters on business_id with no index to use.
create index if not exists idx_customer_notifications_business on customer_notifications(business_id);
create index if not exists idx_customer_portal_users_business on customer_portal_users(business_id);
