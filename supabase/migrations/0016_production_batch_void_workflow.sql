-- production_batches has no trigger/inventory side effect at all (verified:
-- no triggers on the table, and no view/bottle_transactions reference it —
-- it's a standalone cost record, per the existing code comment on
-- createProductionBatch). Voiding it therefore only needs to stop it
-- counting toward cost totals, not reverse any inventory movement.
alter table production_batches add column if not exists voided boolean not null default false;
alter table production_batches add column if not exists void_reason text;
alter table production_batches add column if not exists voided_at timestamptz;
alter table production_batches add column if not exists voided_by uuid references profiles(id);

insert into permissions (key, module, description) values
  ('production.delete', 'production', 'Void production batches')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key in ('owner', 'admin', 'manager') and p.key = 'production.delete'
on conflict do nothing;

-- p_production_batches_write (inventory.manage) stays as-is for every other
-- column; only the void transition needs production.delete.
create or replace function public.fn_guard_production_batch_void_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (new.voided is distinct from old.voided or new.void_reason is distinct from old.void_reason) then
    if auth.uid() is not null and not fn_has_permission('production.delete') then
      raise exception 'permission denied: production.delete required to void a production batch';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_production_batch_void on production_batches;
create trigger trg_guard_production_batch_void
  before update on production_batches
  for each row execute function fn_guard_production_batch_void_columns();

create or replace function public.fn_void_production_batch(p_batch_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  b record;
begin
  if not fn_has_permission('production.delete') then
    raise exception 'permission denied: production.delete required to void a production batch';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required to void a production batch';
  end if;

  select * into b from production_batches where id = p_batch_id for update;
  if b is null then raise exception 'production batch not found'; end if;
  if b.voided then raise exception 'this production batch is already voided'; end if;

  update production_batches set voided = true, void_reason = p_reason, voided_at = now(), voided_by = auth.uid()
  where id = p_batch_id;
end;
$function$;

grant execute on function public.fn_void_production_batch(uuid, text) to authenticated;
