-- Defense in depth against privilege escalation via direct writes to
-- profiles.role_id / profiles.is_active (e.g. raw PostgREST calls that
-- bypass the app-level checks in updateUserRole/toggleUserActive).
-- Blocks any authenticated caller lacking users.manage from changing either
-- column; no-JWT-context callers (service role) are trusted, matching how
-- fn_has_permission itself is used elsewhere in this schema.
create or replace function public.fn_guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (new.role_id is distinct from old.role_id or new.is_active is distinct from old.is_active) then
    if auth.uid() is not null and not fn_has_permission('users.manage') then
      raise exception 'permission denied: users.manage required to change role or active status';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_profile_privilege on public.profiles;
create trigger trg_guard_profile_privilege
  before update on public.profiles
  for each row execute function fn_guard_profile_privilege_columns();
