-- Accounting & Finance upgrade. Additive only: historical postings are not
-- rewritten or backfilled. Opening balances must be reconciled explicitly.

create schema if not exists backup;
create table if not exists backup.finance_chart_of_accounts_20261015 as table public.chart_of_accounts;
create table if not exists backup.finance_journal_entries_20261015 as table public.journal_entries;
create table if not exists backup.finance_journal_lines_20261015 as table public.journal_lines;
create table if not exists backup.finance_daily_closings_20261015 as table public.daily_closings;

alter table public.chart_of_accounts add column if not exists parent_account_id uuid references public.chart_of_accounts(id);
alter table public.chart_of_accounts add column if not exists account_group text;
alter table public.chart_of_accounts add column if not exists opening_balance numeric(14,2) not null default 0;
alter table public.chart_of_accounts add column if not exists opening_balance_date date;
create index if not exists idx_coa_business_parent on public.chart_of_accounts(business_id,parent_account_id);

alter table public.journal_entries add column if not exists voucher_type text not null default 'journal';
alter table public.journal_entries add column if not exists status text not null default 'posted';
alter table public.journal_entries add column if not exists idempotency_key text;
alter table public.journal_entries add column if not exists approved_by uuid references public.profiles(id);
alter table public.journal_entries add column if not exists approved_at timestamptz;
alter table public.journal_entries add column if not exists posted_at timestamptz;
alter table public.journal_entries add column if not exists reversal_of uuid references public.journal_entries(id);
alter table public.journal_entries add column if not exists reversal_reason text;
alter table public.journal_entries add column if not exists attachment_path text;
create unique index if not exists uq_journal_idempotency on public.journal_entries(business_id,idempotency_key) where idempotency_key is not null;
create unique index if not exists uq_journal_source_once on public.journal_entries(business_id,source_module,source_id) where source_module is not null and source_id is not null and source_module <> 'journal_void';
create index if not exists idx_journal_business_status_date on public.journal_entries(business_id,status,entry_date desc);

create or replace view public.v_trial_balance with (security_invoker=true) as
select coa.id account_id,coa.code,coa.name,coa.type,
 coalesce(sum(jl.debit) filter(where je.status='posted'),0::numeric) total_debit,
 coalesce(sum(jl.credit) filter(where je.status='posted'),0::numeric) total_credit,
 coalesce(sum(jl.debit-jl.credit) filter(where je.status='posted'),0::numeric) balance
from public.chart_of_accounts coa
left join public.journal_lines jl on jl.account_id=coa.id
left join public.journal_entries je on je.id=jl.journal_id
where coa.is_active group by coa.id,coa.code,coa.name,coa.type order by coa.code;

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  cash_account_id uuid not null references public.cash_accounts(id), file_name text not null,
  file_hash text not null, statement_from date, statement_to date,
  status text not null default 'review' check (status in ('review','approved','rejected')),
  imported_by uuid not null references public.profiles(id), approved_by uuid references public.profiles(id),
  approved_at timestamptz, created_at timestamptz not null default now(),
  unique(business_id,cash_account_id,file_hash)
);
create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  import_id uuid not null references public.bank_statement_imports(id) on delete cascade,
  txn_date date not null, description text, reference text, amount numeric(14,2) not null,
  fingerprint text not null, match_status text not null default 'unmatched' check (match_status in ('unmatched','matched','duplicate','ignored')),
  matched_cash_transaction_id uuid references public.cash_transactions(id), reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz, unique(business_id,fingerprint)
);
create index if not exists idx_bank_lines_review on public.bank_statement_lines(business_id,match_status,txn_date desc);

create table if not exists public.financial_periods (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  period_start date not null, period_end date not null, status text not null default 'open' check(status in ('open','closed')),
  closed_by uuid references public.profiles(id), closed_at timestamptz, notes text,
  check(period_end >= period_start), unique(business_id,period_start,period_end)
);

alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.financial_periods enable row level security;
create policy p_bank_imports_business on public.bank_statement_imports for all to authenticated
  using (business_id=public.fn_current_business_id() and public.fn_has_permission('finance.reconcile'))
  with check (business_id=public.fn_current_business_id() and public.fn_has_permission('finance.reconcile'));
create policy p_bank_lines_business on public.bank_statement_lines for all to authenticated
  using (business_id=public.fn_current_business_id() and public.fn_has_permission('finance.reconcile'))
  with check (business_id=public.fn_current_business_id() and public.fn_has_permission('finance.reconcile'));
create policy p_periods_read on public.financial_periods for select to authenticated using (business_id=public.fn_current_business_id() and public.fn_has_permission('finance.view'));
create policy p_periods_manage on public.financial_periods for all to authenticated
  using (business_id=public.fn_current_business_id() and public.fn_has_permission('finance.approve'))
  with check (business_id=public.fn_current_business_id() and public.fn_has_permission('finance.approve'));

insert into public.permissions(key,module,description) values
 ('finance.view','finance','View accounting reports and ledgers'),
 ('finance.post','finance','Create and post finance vouchers'),
 ('finance.approve','finance','Approve vouchers, closings and financial periods'),
 ('finance.reconcile','finance','Import and reconcile bank or Easypaisa statements')
on conflict(key) do nothing;
alter table public.role_permissions disable trigger trg_audit_role_permissions;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in ('owner','admin','accountant') and p.key in ('finance.view','finance.post','finance.reconcile') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in ('owner','admin') and p.key='finance.approve' on conflict do nothing;
alter table public.role_permissions enable trigger trg_audit_role_permissions;

create or replace function public.fn_finance_period_open(p_date date) returns boolean
language sql stable security invoker set search_path='' as $$
 select not exists(select 1 from public.financial_periods where business_id=public.fn_current_business_id() and status='closed' and p_date between period_start and period_end)
$$;

create or replace function public.fn_create_finance_voucher(
  p_voucher_type text,p_entry_date date,p_description text,p_reference text,p_lines jsonb,p_idempotency_key text,
  p_submit_for_approval boolean default true,p_attachment_path text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_business uuid:=public.fn_current_business_id(); v_actor uuid:=auth.uid(); v_id uuid; v_line jsonb; v_debit numeric:=0; v_credit numeric:=0; v_count int:=0;
begin
 if v_actor is null or not public.fn_has_permission('finance.post') then raise exception 'permission denied: finance.post required'; end if;
 if p_voucher_type not in ('receipt','payment','journal','transfer','adjustment') then raise exception 'invalid voucher type'; end if;
 if not public.fn_finance_period_open(p_entry_date) then raise exception 'financial period is closed'; end if;
 if coalesce(btrim(p_idempotency_key),'')='' then raise exception 'idempotency key required'; end if;
 select id into v_id from public.journal_entries where business_id=v_business and idempotency_key=p_idempotency_key;
 if v_id is not null then return v_id; end if;
 for v_line in select * from jsonb_array_elements(p_lines) loop
   v_count:=v_count+1; v_debit:=v_debit+coalesce((v_line->>'debit')::numeric,0); v_credit:=v_credit+coalesce((v_line->>'credit')::numeric,0);
   if coalesce((v_line->>'debit')::numeric,0)<0 or coalesce((v_line->>'credit')::numeric,0)<0 or (coalesce((v_line->>'debit')::numeric,0)>0 and coalesce((v_line->>'credit')::numeric,0)>0) then raise exception 'invalid debit/credit line'; end if;
 end loop;
 if v_count<2 or round(v_debit,2)<>round(v_credit,2) or v_debit<=0 then raise exception 'voucher must contain at least two balanced lines'; end if;
 insert into public.journal_entries(entry_no,entry_date,reference,description,source_module,created_by,business_id,voucher_type,status,idempotency_key,attachment_path,posted_at)
 values(upper(left(p_voucher_type,3))||'-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'),p_entry_date,nullif(btrim(p_reference),''),btrim(p_description),'manual_voucher',v_actor,v_business,p_voucher_type,case when p_submit_for_approval then 'pending_approval' else 'draft' end,p_idempotency_key,p_attachment_path,null)
 returning id into v_id;
 for v_line in select * from jsonb_array_elements(p_lines) loop
   insert into public.journal_lines(journal_id,account_id,debit,credit,business_id)
   select v_id,a.id,coalesce((v_line->>'debit')::numeric,0),coalesce((v_line->>'credit')::numeric,0),v_business from public.chart_of_accounts a where a.id=(v_line->>'account_id')::uuid and a.business_id=v_business and a.is_active;
   if not found then raise exception 'invalid or inactive account'; end if;
 end loop;
 return v_id;
end $$;

create or replace function public.fn_approve_finance_voucher(p_entry_id uuid,p_approve boolean,p_reason text default null) returns void
language plpgsql security definer set search_path='' as $$
declare v_row public.journal_entries%rowtype;
begin
 if not public.fn_has_permission('finance.approve') then raise exception 'permission denied: finance.approve required'; end if;
 select * into v_row from public.journal_entries where id=p_entry_id and business_id=public.fn_current_business_id() for update;
 if v_row.id is null or v_row.status<>'pending_approval' then raise exception 'voucher is not pending approval'; end if;
 if p_approve and not public.fn_finance_period_open(v_row.entry_date) then raise exception 'financial period is closed'; end if;
 update public.journal_entries set status=case when p_approve then 'posted' else 'rejected' end,approved_by=auth.uid(),approved_at=now(),posted_at=case when p_approve then now() else null end,reversal_reason=case when not p_approve then nullif(btrim(p_reason),'') else reversal_reason end where id=p_entry_id;
 insert into public.audit_logs(user_id,action,module,record_id,new_value,business_id) values(auth.uid(),case when p_approve then 'APPROVE' else 'REJECT' end,'journal_entries',p_entry_id,jsonb_build_object('reason',p_reason),public.fn_current_business_id());
end $$;

create or replace function public.fn_close_finance_day(p_date date,p_opening numeric,p_actual numeric,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_business uuid:=public.fn_current_business_id(); v_id uuid; v_sales numeric; v_collections numeric; v_cash_collections numeric; v_expenses numeric; v_cash_expenses numeric; v_expected numeric;
begin
 if not public.fn_has_permission('finance.post') then raise exception 'permission denied: finance.post required'; end if;
 if not public.fn_finance_period_open(p_date) then raise exception 'financial period is closed'; end if;
 select coalesce(sum(net_amount),0) into v_sales from public.invoices where business_id=v_business and invoice_date=p_date and status<>'void';
 select coalesce(sum(amount),0),coalesce(sum(amount) filter(where method='cash'),0) into v_collections,v_cash_collections from public.payments where business_id=v_business and payment_date=p_date and not voided;
 select coalesce(sum(amount),0),coalesce(sum(amount) filter(where payment_method='cash'),0) into v_expenses,v_cash_expenses from public.expenses where business_id=v_business and expense_date=p_date and status in ('approved','paid');
 v_expected:=p_opening+v_cash_collections-v_cash_expenses;
 if abs(p_actual-v_expected)>=1 and length(btrim(coalesce(p_reason,'')))<5 then raise exception 'explain the cash difference before closing'; end if;
 insert into public.daily_closings(business_id,closing_no,close_date,opening_cash,sales_total,collections_total,cash_collections,expenses_total,cash_expenses,expected_cash,actual_cash,difference,difference_reason,status,closed_by,closed_at)
 values(v_business,'CLOSE-'||to_char(p_date,'YYYYMMDD'),p_date,p_opening,v_sales,v_collections,v_cash_collections,v_expenses,v_cash_expenses,v_expected,p_actual,p_actual-v_expected,nullif(btrim(p_reason),''),'pending_approval',auth.uid(),now())
 on conflict do nothing returning id into v_id;
 if v_id is null then raise exception 'this day is already closed'; end if; return v_id;
end $$;

revoke all on function public.fn_create_finance_voucher(text,date,text,text,jsonb,text,boolean,text) from public,anon;
revoke all on function public.fn_approve_finance_voucher(uuid,boolean,text) from public,anon;
revoke all on function public.fn_close_finance_day(date,numeric,numeric,text) from public,anon;
grant execute on function public.fn_create_finance_voucher(text,date,text,text,jsonb,text,boolean,text) to authenticated;
grant execute on function public.fn_approve_finance_voucher(uuid,boolean,text) to authenticated;
grant execute on function public.fn_close_finance_day(date,numeric,numeric,text) to authenticated;

-- Received inventory purchases create exactly one AP journal. Re-running the
-- refresh updates that same source journal while purchase items are assembled.
create or replace function public.fn_refresh_purchase_journal(p_purchase_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.purchases%rowtype; v_total numeric; v_journal uuid; v_inventory uuid; v_payable uuid;
begin
 select * into p from public.purchases where id=p_purchase_id;
 if p.id is null or p.status::text<>'received' then return; end if;
 select coalesce(sum(quantity*rate-coalesce(discount,0)),0) into v_total from public.purchase_items where purchase_id=p.id;
 if v_total<=0 then return; end if;
 select id into v_inventory from public.chart_of_accounts where business_id=p.business_id and code='1200';
 select id into v_payable from public.chart_of_accounts where business_id=p.business_id and code='2000';
 if v_inventory is null or v_payable is null then raise exception 'inventory or payable account is not configured'; end if;
 select id into v_journal from public.journal_entries where business_id=p.business_id and source_module='purchases' and source_id=p.id;
 if v_journal is null then
   insert into public.journal_entries(entry_no,entry_date,reference,description,source_module,source_id,created_by,business_id,voucher_type,status,idempotency_key,posted_at)
   values('PUR-'||left(p.id::text,8),p.purchase_date,p.purchase_no,'Inventory purchase','purchases',p.id,p.created_by,p.business_id,'purchase','posted','purchase:'||p.id,now()) returning id into v_journal;
 else delete from public.journal_lines where journal_id=v_journal; end if;
 insert into public.journal_lines(journal_id,account_id,debit,credit,business_id) values
  (v_journal,v_inventory,v_total,0,p.business_id),(v_journal,v_payable,0,v_total,p.business_id);
end $$;

create or replace function public.fn_purchase_item_journal_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then perform public.fn_refresh_purchase_journal(old.purchase_id); return old;
 else perform public.fn_refresh_purchase_journal(new.purchase_id); return new; end if;
end $$;
drop trigger if exists trg_purchase_item_journal on public.purchase_items;
create constraint trigger trg_purchase_item_journal after insert or update or delete on public.purchase_items
deferrable initially deferred for each row execute function public.fn_purchase_item_journal_trigger();

create or replace function public.fn_supplier_payment_journal_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_payable uuid; v_cash uuid; v_journal uuid;
begin
 select id into v_payable from public.chart_of_accounts where business_id=new.business_id and code='2000';
 select id into v_cash from public.chart_of_accounts where business_id=new.business_id and code=case when new.method::text='cash' then '1000' else '1010' end;
 if v_payable is null or v_cash is null then raise exception 'payable or cash/bank account is not configured'; end if;
 insert into public.journal_entries(entry_no,entry_date,reference,description,source_module,source_id,created_by,business_id,voucher_type,status,idempotency_key,posted_at)
 values('SP-'||left(new.id::text,8),new.payment_date,new.reference,'Supplier payment','supplier_payments',new.id,new.created_by,new.business_id,'payment','posted','supplier-payment:'||new.id,now()) returning id into v_journal;
 insert into public.journal_lines(journal_id,account_id,debit,credit,business_id) values
  (v_journal,v_payable,new.amount,0,new.business_id),(v_journal,v_cash,0,new.amount,new.business_id);
 return new;
end $$;
drop trigger if exists trg_supplier_payment_journal on public.supplier_payments;
create trigger trg_supplier_payment_journal after insert on public.supplier_payments for each row execute function public.fn_supplier_payment_journal_trigger();
