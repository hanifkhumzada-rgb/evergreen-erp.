-- Smart User Management & Access Control 3.0
-- Keeps the existing roles / permissions / role_permissions /
-- user_permission_overrides model and adds an atomic, Owner-only write path.

create or replace function public.fn_guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_old_role text;
  v_new_role text;
  v_active_owner_count integer;
begin
  if new.role_id is not distinct from old.role_id
     and new.is_active is not distinct from old.is_active then
    return new;
  end if;

  -- Service-role maintenance has no auth.uid(); normal requests must pass
  -- both the generic permission check and the protected Owner boundary.
  if auth.uid() is not null then
    if not public.fn_has_permission('users.manage') then
      raise exception 'permission denied: users.manage required';
    end if;
    if old.id = auth.uid() then
      raise exception 'permission denied: users cannot change their own role or status';
    end if;

    select public.fn_current_role_key() into v_actor_role;
    select key into v_old_role from public.roles where id = old.role_id;
    select key into v_new_role from public.roles where id = new.role_id;

    if (v_old_role = 'owner' or v_new_role = 'owner') and v_actor_role <> 'owner' then
      raise exception 'permission denied: only an Owner can grant or change Owner access';
    end if;

    if v_old_role = 'owner' and old.is_active
       and (v_new_role <> 'owner' or not new.is_active) then
      select count(*) into v_active_owner_count
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where r.key = 'owner' and p.is_active;
      if v_active_owner_count <= 1 then
        raise exception 'cannot remove or deactivate the final active Owner';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.fn_guard_profile_privilege_columns() from public, anon;

-- Direct Data API writes to overrides must follow the same Owner-only rule
-- as the atomic RPC. Effective permission reads use SECURITY DEFINER helper
-- functions, so restricting this table does not affect normal app access.
alter table public.user_permission_overrides enable row level security;
drop policy if exists p_user_overrides_admin on public.user_permission_overrides;
drop policy if exists p_user_overrides_owner_select on public.user_permission_overrides;
drop policy if exists p_user_overrides_owner_insert on public.user_permission_overrides;
drop policy if exists p_user_overrides_owner_update on public.user_permission_overrides;
drop policy if exists p_user_overrides_owner_delete on public.user_permission_overrides;

create policy p_user_overrides_owner_select on public.user_permission_overrides
for select to authenticated
using (
  (select public.fn_current_role_key()) = 'owner'
  and exists (
    select 1 from public.profiles target
    where target.id = user_id
      and target.business_id = (select public.fn_current_business_id())
  )
);

create policy p_user_overrides_owner_insert on public.user_permission_overrides
for insert to authenticated
with check (
  (select public.fn_current_role_key()) = 'owner'
  and user_id <> (select auth.uid())
  and exists (
    select 1 from public.profiles target
    join public.roles target_role on target_role.id = target.role_id
    where target.id = user_id
      and target.business_id = (select public.fn_current_business_id())
      and target_role.key <> 'owner'
  )
);

create policy p_user_overrides_owner_update on public.user_permission_overrides
for update to authenticated
using (
  (select public.fn_current_role_key()) = 'owner'
  and user_id <> (select auth.uid())
)
with check (
  (select public.fn_current_role_key()) = 'owner'
  and user_id <> (select auth.uid())
  and exists (
    select 1 from public.profiles target
    join public.roles target_role on target_role.id = target.role_id
    where target.id = user_id
      and target.business_id = (select public.fn_current_business_id())
      and target_role.key <> 'owner'
  )
);

create policy p_user_overrides_owner_delete on public.user_permission_overrides
for delete to authenticated
using (
  (select public.fn_current_role_key()) = 'owner'
  and user_id <> (select auth.uid())
  and exists (
    select 1 from public.profiles target
    where target.id = user_id
      and target.business_id = (select public.fn_current_business_id())
  )
);

create or replace function public.fn_apply_user_permission_overrides(
  p_user_id uuid,
  p_changes jsonb,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_business uuid;
  v_target_business uuid;
  v_target_role text;
  v_change jsonb;
  v_permission_id uuid;
  v_permission_key text;
  v_allow boolean;
  v_old_allow boolean;
  v_count integer := 0;
  v_sensitive boolean := false;
begin
  if v_actor is null or public.fn_current_role_key() <> 'owner' then
    raise exception 'permission denied: Owner access required';
  end if;
  if p_user_id = v_actor then
    raise exception 'users cannot change their own permissions';
  end if;
  if jsonb_typeof(p_changes) <> 'array' then
    raise exception 'changes must be a JSON array';
  end if;

  select business_id into v_actor_business from public.profiles where id = v_actor and is_active;
  select p.business_id, r.key into v_target_business, v_target_role
  from public.profiles p join public.roles r on r.id = p.role_id
  where p.id = p_user_id;

  if v_target_business is null or v_target_business is distinct from v_actor_business then
    raise exception 'target user not found in your business';
  end if;
  if v_target_role = 'owner' then
    raise exception 'Owner permission overrides are protected';
  end if;

  for v_change in select value from jsonb_array_elements(p_changes)
  loop
    v_permission_key := nullif(trim(v_change->>'permissionKey'), '');
    if v_permission_key is null or not (v_change ? 'allow') then
      raise exception 'each change needs permissionKey and allow';
    end if;
    if jsonb_typeof(v_change->'allow') not in ('boolean', 'null') then
      raise exception 'allow must be true, false, or null';
    end if;

    select id into v_permission_id from public.permissions where key = v_permission_key;
    if v_permission_id is null then
      raise exception 'unknown permission: %', v_permission_key;
    end if;

    select allow into v_old_allow
    from public.user_permission_overrides
    where user_id = p_user_id and permission_id = v_permission_id;
    v_allow := case when jsonb_typeof(v_change->'allow') = 'null' then null else (v_change->>'allow')::boolean end;

    v_sensitive := v_sensitive
      or v_permission_key in ('users.manage', 'settings.manage')
      or v_permission_key like '%.delete'
      or v_permission_key like '%.approve';

    if v_allow is null then
      delete from public.user_permission_overrides
      where user_id = p_user_id and permission_id = v_permission_id;
    else
      insert into public.user_permission_overrides (user_id, permission_id, allow)
      values (p_user_id, v_permission_id, v_allow)
      on conflict (user_id, permission_id) do update set allow = excluded.allow;
    end if;

    insert into public.audit_logs
      (user_id, action, module, record_id, old_value, new_value, business_id)
    values
      (v_actor, 'PERMISSION_CHANGE', 'permissions', p_user_id,
       jsonb_build_object('permission', v_permission_key, 'override', v_old_allow),
       jsonb_build_object('permission', v_permission_key, 'override', v_allow, 'reason', nullif(trim(p_reason), '')),
       v_actor_business);
    v_count := v_count + 1;
  end loop;

  if v_sensitive and nullif(trim(p_reason), '') is null then
    raise exception 'a reason is required for sensitive permission changes';
  end if;

  return v_count;
end;
$$;

revoke all on function public.fn_apply_user_permission_overrides(uuid, jsonb, text) from public, anon;
grant execute on function public.fn_apply_user_permission_overrides(uuid, jsonb, text) to authenticated, service_role;
