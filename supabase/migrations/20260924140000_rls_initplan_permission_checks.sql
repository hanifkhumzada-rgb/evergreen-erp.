-- Performance fix — no security/behaviour change.
--
-- 20260917000000_rls_initplan_perf_fix wrapped fn_current_business_id() /
-- fn_current_customer_id() in `(select ...)` so Postgres evaluates them
-- once per query (InitPlan). It did not cover the other three functions
-- used inside policies, which were still evaluated once PER ROW:
--
--   fn_has_permission('<literal>')  106 policies (a 4-table lookup each call)
--   fn_current_role_key()             4 policies (a 2-table lookup each call)
--   auth.uid()                       31 policies
--
-- Measured live before this change (TEST Manager, 18 customers):
--   select count(*) from customers where is_active  → 867 buffer hits, 12 ms
-- i.e. ~0.5 ms per row, so it grows linearly with table size (thousands of
-- deliveries / ledger rows → seconds). pg_stat_statements showed the
-- dashboard's customer count averaging 162 ms (max 978 ms).
--
-- Every call site passes only constants (verified: fn_has_permission is
-- always called with a string literal), all three functions are STABLE and
-- none reference the row, so `(select f(...))` returns exactly the same
-- value — only the planner's ability to cache it changes. This is the
-- pattern Supabase documents for RLS performance (auth_rls_initplan).
--
-- Idempotent: the lookbehind guards skip calls that are already wrapped.
do $$
declare
  pol record;
  new_qual text;
  new_check text;
  stmt text;
begin
  for pol in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )(?<!select )(fn_has_permission\(|fn_current_role_key\(\)|auth\.uid\(\))'
  loop
    new_qual := pol.qual;
    new_check := pol.with_check;

    if new_qual is not null then
      new_qual := regexp_replace(new_qual, '(?<!SELECT )(?<!select )(?<!public\.)fn_has_permission\((''[a-z_.]+''::text)\)', '(select public.fn_has_permission(\1))', 'g');
      new_qual := regexp_replace(new_qual, '(?<!SELECT )(?<!select )(?<!public\.)fn_current_role_key\(\)', '(select public.fn_current_role_key())', 'g');
      new_qual := regexp_replace(new_qual, '(?<!SELECT )(?<!select )auth\.uid\(\)', '(select auth.uid())', 'g');
    end if;
    if new_check is not null then
      new_check := regexp_replace(new_check, '(?<!SELECT )(?<!select )(?<!public\.)fn_has_permission\((''[a-z_.]+''::text)\)', '(select public.fn_has_permission(\1))', 'g');
      new_check := regexp_replace(new_check, '(?<!SELECT )(?<!select )(?<!public\.)fn_current_role_key\(\)', '(select public.fn_current_role_key())', 'g');
      new_check := regexp_replace(new_check, '(?<!SELECT )(?<!select )auth\.uid\(\)', '(select auth.uid())', 'g');
    end if;

    if new_qual is not distinct from pol.qual and new_check is not distinct from pol.with_check then
      continue;
    end if;

    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);

    stmt := format(
      'create policy %I on public.%I as %s for %s to %s',
      pol.policyname, pol.tablename,
      case when pol.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      pol.cmd,
      array_to_string(pol.roles, ', ')
    );
    if new_qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;

    execute stmt;
  end loop;
end $$;
