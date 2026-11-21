REVOKE EXECUTE ON FUNCTION public.get_room_availability_status(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_availability_status(text) TO service_role;