-- Fix: fn_request_customer_otp used pgcrypto's digest() but its
-- SECURITY DEFINER search_path was locked to 'public' only. On this
-- project pgcrypto is installed in the 'extensions' schema (Supabase's
-- default), not 'public', so digest() was unresolvable and every OTP
-- request failed with "function digest(text, unknown) does not exist" --
-- caught live while verifying migration 0033 against a real (temporarily
-- reactivated, then rolled back) customer row. Re-declaring both OTP
-- functions with 'extensions' added to search_path fixes this; function
-- bodies are otherwise unchanged from migration 0033.

create or replace function fn_request_customer_otp(p_mobile text)
returns table(customer_id uuid, otp_code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_customer record;
  v_code text;
  v_digits text;
begin
  v_digits := right(regexp_replace(p_mobile, '\D', '', 'g'), 10);
  select c.id, c.business_id into v_customer from customers c
    where right(regexp_replace(c.mobile, '\D', '', 'g'), 10) = v_digits and c.is_active
    limit 1;
  if v_customer.id is null then
    raise exception 'No active customer found with this mobile number.';
  end if;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into customer_otp_sessions (business_id, customer_id, mobile, otp_hash, expires_at)
  values (v_customer.business_id, v_customer.id, p_mobile, encode(digest(v_code, 'sha256'), 'hex'), now() + interval '5 minutes');

  return query select v_customer.id, v_code;
end;
$$;

grant execute on function fn_request_customer_otp(text) to anon, authenticated;

create or replace function fn_verify_customer_otp(p_mobile text, p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session record;
begin
  select * into v_session from customer_otp_sessions
    where mobile = p_mobile and verified_at is null and expires_at > now()
    order by created_at desc limit 1;

  if v_session.id is null then
    raise exception 'No pending verification for this mobile number. Request a new code.';
  end if;

  if v_session.attempt_count >= 5 then
    raise exception 'Too many attempts. Request a new code.';
  end if;

  if v_session.otp_hash != encode(digest(p_code, 'sha256'), 'hex') then
    update customer_otp_sessions set attempt_count = attempt_count + 1 where id = v_session.id;
    raise exception 'Incorrect code.';
  end if;

  update customer_otp_sessions set verified_at = now() where id = v_session.id;
  return v_session.customer_id;
end;
$$;

grant execute on function fn_verify_customer_otp(text, text) to anon, authenticated;
