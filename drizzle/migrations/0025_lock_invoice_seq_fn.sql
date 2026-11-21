REVOKE EXECUTE ON FUNCTION public.be_next_invoice_seq(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_next_invoice_seq(text, text) TO service_role;