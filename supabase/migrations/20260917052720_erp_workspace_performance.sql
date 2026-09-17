-- Read-only ERP shell batching. Existing auth, grants and RLS remain intact.
create or replace function public.fn_erp_workspace_context()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_actor uuid := auth.uid(); v_profile jsonb; v_permissions jsonb; v_unread bigint;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select to_jsonb(p) || jsonb_build_object('roles',jsonb_build_object('key',r.key,'name',r.name))
 into v_profile from public.profiles p left join public.roles r on r.id=p.role_id where p.id=v_actor;
 if v_profile is null then return jsonb_build_object('profile',null,'permissions','[]'::jsonb,'unread_notifications',0); end if;
 -- Customers need only their identity to be redirected out of the ERP.
 if v_profile->'roles'->>'key'='customer' then
  return jsonb_build_object('profile',v_profile,'permissions','[]'::jsonb,'unread_notifications',0);
 end if;
 select coalesce(jsonb_agg(permission_key order by permission_key),'[]'::jsonb)
 into v_permissions from public.fn_my_permission_keys();
 select count(*) into v_unread from public.notifications where is_read=false;
 return jsonb_build_object('profile',v_profile,'permissions',v_permissions,'unread_notifications',v_unread);
end $$;
revoke all on function public.fn_erp_workspace_context() from public,anon;
grant execute on function public.fn_erp_workspace_context() to authenticated;
