REVOKE EXECUTE ON FUNCTION public.increment_traveller_stats(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_traveller_stats(text, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_visitor_session_count(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_visitor_session_count(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.generate_booking_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_booking_id() TO service_role;