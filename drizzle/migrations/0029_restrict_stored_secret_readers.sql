REVOKE EXECUTE ON FUNCTION public.get_app_secret(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_app_secret_secure(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_app_secret(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_app_secret_secure(text) TO authenticated, service_role;

-- authenticated is the shared sign-in role, not an admin role. Both existing
-- SECURITY DEFINER bodies must keep their caller-bound get_user_role() checks.
DO $$
DECLARE
  reader regprocedure;
BEGIN
  FOREACH reader IN ARRAY ARRAY['public.get_app_secret(text)'::regprocedure, 'public.get_app_secret_secure(text)'::regprocedure]
  LOOP
    IF has_function_privilege('anon', reader, 'EXECUTE') THEN
      RAISE EXCEPTION 'Anonymous secret reader access must be denied: %', reader;
    END IF;
    IF NOT has_function_privilege('authenticated', reader, 'EXECUTE') OR NOT has_function_privilege('service_role', reader, 'EXECUTE') THEN
      RAISE EXCEPTION 'Admin and backend entry permissions must be retained: %', reader;
    END IF;
  END LOOP;
END;
$$;