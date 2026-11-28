CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
      RETURN false;
    END IF;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = _role);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DO $test$
DECLARE
  target uuid;
  target_role public.app_role;
  saved_claims text := current_setting('request.jwt.claims', true);
  saved_sub text := current_setting('request.jwt.claim.sub', true);
  saved_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF has_function_privilege('anon', 'public.has_role(uuid,public.app_role)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role lookup must be denied';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.has_role(uuid,public.app_role)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.has_role(uuid,public.app_role)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Own-role and backend checks must remain callable';
  END IF;
  SELECT user_id, role INTO target, target_role FROM public.user_roles LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'Role verification requires an existing role'; END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  IF public.has_role(target, target_role) THEN RAISE EXCEPTION 'Anonymous lookup leaked a role'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','authenticated','sub',target)::text, true);
  IF NOT public.has_role(target, target_role) THEN RAISE EXCEPTION 'Own role lookup failed'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','authenticated','sub',gen_random_uuid())::text, true);
  IF public.has_role(target, target_role) THEN RAISE EXCEPTION 'Other-account lookup leaked a role'; END IF;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  IF NOT public.has_role(target, target_role) THEN RAISE EXCEPTION 'Backend role lookup failed'; END IF;
  PERFORM set_config('request.jwt.claims', coalesce(saved_claims,''), true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(saved_sub,''), true);
  PERFORM set_config('request.jwt.claim.role', coalesce(saved_role,''), true);
END;
$test$;