CREATE OR REPLACE FUNCTION public.be_can_access_checkin_property(p_property_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
 SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = (select auth.uid()) AND u.email_confirmed_at IS NOT NULL AND (
 (lower(u.email) = 'admin@xtsy.one' AND public.has_role(u.id, 'admin'::public.app_role)) OR
 (lower(u.email) = 'booking@xtsy.one' AND p_property_id = 'XTSY-SHL-HOSTEL' AND public.has_role(u.id, 'staff'::public.app_role))));
$$;
REVOKE EXECUTE ON FUNCTION public.be_can_access_checkin_property(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.be_can_access_checkin_property(text) TO authenticated, service_role;
ALTER POLICY be_self_check_ins_staff_read ON public.be_self_check_ins USING (public.be_can_access_checkin_property(property_id));
ALTER POLICY be_self_check_ins_staff_update ON public.be_self_check_ins USING (public.be_can_access_checkin_property(property_id)) WITH CHECK (public.be_can_access_checkin_property(property_id));
ALTER POLICY guest_identity_documents_staff_read ON storage.objects USING (bucket_id = 'guest-identity-documents' AND EXISTS (SELECT 1 FROM public.be_self_check_ins c WHERE c.id::text = split_part(name, '/', 1) AND public.be_can_access_checkin_property(c.property_id)));
ALTER POLICY guest_identity_documents_staff_delete ON storage.objects USING (bucket_id = 'guest-identity-documents' AND EXISTS (SELECT 1 FROM public.be_self_check_ins c WHERE c.id::text = split_part(name, '/', 1) AND public.be_can_access_checkin_property(c.property_id)));