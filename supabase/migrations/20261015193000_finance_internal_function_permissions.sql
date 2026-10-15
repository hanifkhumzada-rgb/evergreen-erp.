-- Internal finance posting helpers are invoked only by database triggers/functions.
-- Keep them unavailable through the exposed REST/RPC API.
revoke all on function public.fn_refresh_purchase_journal(uuid) from public, anon, authenticated;
revoke all on function public.fn_purchase_item_journal_trigger() from public, anon, authenticated;
revoke all on function public.fn_supplier_payment_journal_trigger() from public, anon, authenticated;
