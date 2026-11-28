ALTER TABLE public.be_bookings ADD COLUMN property_id text NOT NULL DEFAULT 'XTSY-SHL-HOSTEL';
CREATE INDEX be_bookings_property_checkin_idx ON public.be_bookings(property_id, check_in);
CREATE OR REPLACE FUNCTION public.be_can_manage_property(p_property_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
 SELECT public.be_is_console_admin() OR (p_property_id IN ('XTSY-SHL-HOSTEL','XTSY-SHL-SUITE') AND public.be_is_checkin_staff());
$$;
REVOKE EXECUTE ON FUNCTION public.be_can_manage_property(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.be_can_manage_property(text) TO authenticated, service_role;
DO $$
DECLARE item record; pol record; condition text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('be_bookings','public.be_can_manage_property(property_id)',false),
 ('be_booking_lines','EXISTS (SELECT 1 FROM public.be_bookings b WHERE b.id = booking_id AND public.be_can_manage_property(b.property_id))',false),
 ('be_holds','EXISTS (SELECT 1 FROM public.be_bookings b WHERE b.id = booking_id AND public.be_can_manage_property(b.property_id))',false),
 ('be_payments','EXISTS (SELECT 1 FROM public.be_bookings b WHERE b.id = booking_id AND public.be_can_manage_property(b.property_id))',false),
 ('be_guests','EXISTS (SELECT 1 FROM public.be_bookings b WHERE b.id = booking_id AND public.be_can_manage_property(b.property_id))',false),
 ('be_change_requests','EXISTS (SELECT 1 FROM public.be_bookings b WHERE b.id = booking_id AND public.be_can_manage_property(b.property_id))',false),
 ('be_invoices','public.be_can_manage_property(property_id)',false),
 ('be_property_invoice_profiles','public.be_can_manage_property(property_id)',false),
 ('be_room_photos','(select public.be_is_checkin_staff())',false),
 ('be_enquiries','((select public.be_is_checkin_staff()) AND kind = ''stay'')',false),
 ('be_settings','(select public.be_is_checkin_staff())',true),
 ('be_sheet_availability','(select public.be_is_checkin_staff())',true),
 ('be_sheet_links','(select public.be_is_checkin_staff())',true),
 ('be_room_mapping','(select public.be_is_checkin_staff())',true),
 ('be_channel_properties','public.be_can_manage_property(id)',true),
 ('be_channel_room_map','public.be_can_manage_property(property_id)',true),
 ('be_channel_sent_counts','public.be_can_manage_property(property_id)',true),
 ('be_ota_bookings','public.be_can_manage_property(property_id)',true),
 ('be_channel_log','EXISTS (SELECT 1 FROM public.be_bookings b WHERE b.id = booking_id AND public.be_can_manage_property(b.property_id))',true)
 ) AS x(tbl,expr,read_only) LOOP
 FOR pol IN SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = item.tbl AND policyname LIKE '%admin%' AND (NOT item.read_only OR cmd = 'SELECT') LOOP
 condition := '(select public.be_is_console_admin()) OR (' || item.expr || ')';
 IF pol.cmd = 'INSERT' THEN EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',pol.policyname,item.tbl,condition);
 ELSIF pol.cmd = 'UPDATE' THEN EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',pol.policyname,item.tbl,condition,condition);
 ELSE EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',pol.policyname,item.tbl,condition);
 END IF;
 END LOOP;
 END LOOP;
END $$;
ALTER POLICY "super admin manages inventory overrides" ON public.console_inventory_overrides USING (public.be_can_manage_property(property_id)) WITH CHECK (public.be_can_manage_property(property_id));
CREATE POLICY hostel_admin_reads_connection_status ON public.console_integration_settings FOR SELECT TO authenticated USING ((select public.be_is_checkin_staff()));
ALTER POLICY "super admin reads audit" ON public.console_audit_log USING ((select public.is_super_admin()) OR (actor = (select auth.uid()) AND (select public.be_is_checkin_staff())));
ALTER POLICY "super admin writes audit" ON public.console_audit_log WITH CHECK (actor = (select auth.uid()) AND ((select public.is_super_admin()) OR (select public.be_is_checkin_staff())));
ALTER POLICY room_photos_admin_insert ON storage.objects WITH CHECK (bucket_id = 'room-photos' AND (select public.be_is_checkin_staff()));
ALTER POLICY room_photos_admin_update ON storage.objects USING (bucket_id = 'room-photos' AND (select public.be_is_checkin_staff())) WITH CHECK (bucket_id = 'room-photos' AND (select public.be_is_checkin_staff()));
ALTER POLICY room_photos_admin_delete ON storage.objects USING (bucket_id = 'room-photos' AND (select public.be_is_checkin_staff()));