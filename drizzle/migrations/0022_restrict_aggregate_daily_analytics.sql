REVOKE EXECUTE ON FUNCTION public.aggregate_daily_analytics(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aggregate_daily_analytics(date) TO service_role;