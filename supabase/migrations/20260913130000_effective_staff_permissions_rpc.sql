create or replace function public.fn_my_permission_keys()
returns table(permission_key text)
language sql
stable
security definer
set search_path = public
as $$
  select perm.key
  from permissions perm
  where auth.uid() is not null
    and exists (
      select 1
      from profiles p
      where p.id = auth.uid()
        and p.is_active = true
    )
    and coalesce(
      (
        select upo.allow
        from user_permission_overrides upo
        where upo.user_id = auth.uid()
          and upo.permission_id = perm.id
        limit 1
      ),
      exists (
        select 1
        from profiles p
        join role_permissions rp on rp.role_id = p.role_id
        where p.id = auth.uid()
          and p.is_active = true
          and rp.permission_id = perm.id
      )
    ) = true
  order by perm.key;
$$;

revoke all on function public.fn_my_permission_keys() from public, anon;
grant execute on function public.fn_my_permission_keys() to authenticated, service_role;
