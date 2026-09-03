-- journal_entries has no create-manually UI anywhere in this app — every
-- row is a system-generated side effect of an expense/payment/invoice/
-- delivery. voidJournalEntry is a generic reversal (mirror the debit/
-- credit of every line into a new entry) but REFUSES to run against an
-- entry whose source_module is one of those four — voiding the journal
-- entry alone while the source record stays active (or after it) would
-- desync the books from the very record that's supposed to explain them;
-- the source's own void action already posts the correct reversal. This
-- function exists for the remaining case: an entry with no recognized
-- source (or a genuinely orphaned one), which is exactly what "reverse its
-- effect on the ledger/trial balance" needs when there's no source record
-- to void instead.
insert into permissions (key, module, description) values
  ('journal.delete', 'journal', 'Void journal entries')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.key in ('owner', 'admin', 'accountant') and p.key = 'journal.delete'
on conflict do nothing;

create or replace function public.fn_void_journal_entry(p_entry_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  je record;
  jl record;
  lines jsonb := '[]'::jsonb;
begin
  if not fn_has_permission('journal.delete') then
    raise exception 'permission denied: journal.delete required to void a journal entry';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required to void a journal entry';
  end if;

  select * into je from journal_entries where id = p_entry_id;
  if je is null then raise exception 'journal entry not found'; end if;

  if exists (select 1 from journal_entries where source_module = 'journal_void' and source_id = p_entry_id) then
    raise exception 'this journal entry has already been voided';
  end if;

  if je.source_module in ('expenses', 'payments', 'invoices', 'deliveries') then
    raise exception 'this entry belongs to a % record — void that record instead (its own void action reverses this entry correctly)', je.source_module;
  end if;

  if je.source_module = 'journal_void' then
    raise exception 'this entry is itself a reversal — post a new correcting entry instead of voiding a reversal';
  end if;

  -- table alias deliberately not `jl` — it collides with the declared
  -- record variable of the same name, which made Postgres resolve
  -- `jl.debit` against the not-yet-assigned loop variable instead of the
  -- table (confirmed live: raised "record jl is not assigned yet" on
  -- every call until renamed).
  for jl in select line.debit, line.credit, ca.code as account_code
            from journal_lines line join chart_of_accounts ca on ca.id = line.account_id
            where line.journal_id = p_entry_id
  loop
    lines := lines || jsonb_build_object('account', jl.account_code, 'debit', jl.credit, 'credit', jl.debit);
  end loop;

  if jsonb_array_length(lines) = 0 then
    raise exception 'journal entry has no lines to reverse';
  end if;

  perform post_journal(current_date, je.entry_no, 'VOID: ' || je.description || ' — ' || p_reason, 'journal_void', p_entry_id, auth.uid(), lines);
end;
$function$;

grant execute on function public.fn_void_journal_entry(uuid, text) to authenticated;
