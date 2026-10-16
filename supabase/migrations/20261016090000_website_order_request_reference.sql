ALTER TABLE public.website_order_requests
  ADD COLUMN IF NOT EXISTS request_reference text;

UPDATE public.website_order_requests
SET request_reference = 'EW-' || upper(replace(id::text, '-', ''))
WHERE request_reference IS NULL;

ALTER TABLE public.website_order_requests
  ALTER COLUMN request_reference SET DEFAULT ('EW-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  ALTER COLUMN request_reference SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS website_order_requests_request_reference_uidx
  ON public.website_order_requests (request_reference);

ALTER TABLE public.website_order_requests
  DROP CONSTRAINT IF EXISTS website_order_requests_address_length,
  DROP CONSTRAINT IF EXISTS website_order_requests_note_length;

ALTER TABLE public.website_order_requests
  ADD CONSTRAINT website_order_requests_address_length
    CHECK (char_length(btrim(delivery_address)) BETWEEN 4 AND 1000),
  ADD CONSTRAINT website_order_requests_note_length
    CHECK (note IS NULL OR char_length(note) <= 700);

DROP POLICY IF EXISTS website_order_requests_public_insert ON public.website_order_requests;

CREATE POLICY website_order_requests_public_insert
  ON public.website_order_requests
  FOR INSERT
  TO anon
  WITH CHECK (
    business_id = '99411dc5-82a4-4ba3-b1d5-5e0e042e096d'::uuid
    AND status = 'pending'
    AND source = 'website'
    AND char_length(btrim(customer_name)) BETWEEN 2 AND 100
    AND char_length(btrim(phone)) BETWEEN 8 AND 20
    AND char_length(btrim(delivery_address)) BETWEEN 4 AND 1000
    AND bottle_quantity BETWEEN 1 AND 50
    AND (note IS NULL OR char_length(note) <= 700)
  );

GRANT INSERT (customer_name, phone, delivery_address, bottle_quantity, note, request_reference)
  ON public.website_order_requests TO anon;
