-- Bug found in the pre-live golden regression (rolled-back test): two
-- Smart Entry payments for the same customer with the same receipt /
-- transaction reference — e.g. the same cash receipt entered from two
-- phones — were BOTH approved and posted. fn_validate_smart_entry only
-- compared against already-posted payments, so two entries pending at the
-- same time both passed, and approval does not re-validate. Result: the
-- customer was credited twice (balance swung from +100 to -400).
--
-- 1. A partial unique index makes a second non-voided payment with the
--    same (business, customer, reference) impossible on every path —
--    Smart Entry approval, the Payments form, delivery collection — and
--    is safe under concurrent submissions. Every system-generated
--    reference is already unique (delivery no. / invoice no.); a voided
--    payment frees its reference for re-entry. Verified no existing rows
--    conflict before creating it.
-- 2. Validation also rejects a payment whose reference is already used by
--    another Smart Entry still awaiting approval, so the operator sees the
--    problem at submit time instead of at approval.
create unique index if not exists uq_payments_customer_reference_active
  on public.payments (business_id, customer_id, lower(btrim(reference)))
  where not voided and nullif(btrim(reference), '') is not null;

-- 2: patch only the payment-reference check inside fn_validate_smart_entry
-- (string replace on the live definition, asserting the anchor exists so
-- the rest of the function is left byte-for-byte unchanged).
do $$
declare
  v_def text := pg_get_functiondef('public.fn_validate_smart_entry(text, jsonb)'::regprocedure);
  v_old text := 'if exists (select 1 from payments where customer_id = (p_payload->>''customer_id'')::uuid and reference = (p_payload->>''reference'') and voided = false) then';
  v_new text := 'if exists (select 1 from payments where business_id = v_business_id and customer_id = (p_payload->>''customer_id'')::uuid and lower(btrim(reference)) = lower(btrim(p_payload->>''reference'')) and voided = false)
         or exists (select 1 from smart_entries se where se.business_id = v_business_id and se.entry_type = ''payment'' and se.status = ''pending_approval''
                      and se.payload->>''customer_id'' = p_payload->>''customer_id''
                      and lower(btrim(se.payload->>''reference'')) = lower(btrim(p_payload->>''reference''))) then';
begin
  if position(v_new in v_def) > 0 then
    return; -- already applied
  end if;
  if position(v_old in v_def) = 0 then
    raise exception 'fn_validate_smart_entry: payment reference check not found; refusing to patch';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;
