CREATE TABLE public.be_property_invoice_profiles (
  property_id text PRIMARY KEY,
  legal_name text NOT NULL,
  gst_registered boolean NOT NULL DEFAULT false,
  gstin text NOT NULL DEFAULT '',
  business_address text NOT NULL,
  state_code text NOT NULL DEFAULT '17',
  sac_code text NOT NULL DEFAULT '996311',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.be_property_invoice_profiles TO authenticated;
GRANT ALL ON public.be_property_invoice_profiles TO service_role;
ALTER TABLE public.be_property_invoice_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY be_property_invoice_profiles_admin_read ON public.be_property_invoice_profiles FOR SELECT TO authenticated USING ((select public.be_is_console_admin()));
CREATE POLICY be_property_invoice_profiles_admin_write ON public.be_property_invoice_profiles FOR INSERT TO authenticated WITH CHECK ((select public.be_is_console_admin()));
CREATE POLICY be_property_invoice_profiles_admin_update ON public.be_property_invoice_profiles FOR UPDATE TO authenticated USING ((select public.be_is_console_admin())) WITH CHECK ((select public.be_is_console_admin()));
CREATE POLICY be_property_invoice_profiles_admin_delete ON public.be_property_invoice_profiles FOR DELETE TO authenticated USING ((select public.be_is_console_admin()));

INSERT INTO public.be_property_invoice_profiles (property_id, legal_name, gst_registered, gstin, business_address, state_code, sac_code)
SELECT 'XTSY-SHL-HOSTEL', coalesce(nullif(s.legal_name, ''), 'XTSY Travellers Hostel'), false, coalesce(s.gstin, ''), coalesce(nullif(s.business_address, ''), 'Mawdiangdiang Road, New Shillong Township, Shillong, Meghalaya 793018'), coalesce(s.state_code, '17'), coalesce(s.sac_code, '996311')
FROM public.be_settings s WHERE s.id = 1
ON CONFLICT (property_id) DO NOTHING;
INSERT INTO public.be_property_invoice_profiles (property_id, legal_name, gst_registered, gstin, business_address)
VALUES ('XTSY-SHN-CAMP', 'Shnonpedeng Riverside Camping by XTSY', false, '', 'By the Umngot river, Shnonpedeng, Meghalaya')
ON CONFLICT (property_id) DO NOTHING;

ALTER TABLE public.be_invoices ADD COLUMN property_id text NOT NULL DEFAULT 'XTSY-SHL-HOSTEL';
ALTER TABLE public.be_invoices ADD COLUMN business_snapshot jsonb;
ALTER TABLE public.be_invoices DROP CONSTRAINT be_invoices_kind_check;
ALTER TABLE public.be_invoices ADD CONSTRAINT be_invoices_kind_check CHECK (kind IN ('advance_receipt', 'tax_invoice', 'business_invoice'));

CREATE TABLE public.be_self_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash text NOT NULL UNIQUE,
  property_id text NOT NULL CHECK (property_id IN ('XTSY-SHL-HOSTEL', 'XTSY-SHN-CAMP')),
  booking_reference text,
  guest_name text NOT NULL,
  check_in_date date NOT NULL,
  check_in_time time NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  country text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  total_guests smallint NOT NULL CHECK (total_guests BETWEEN 1 AND 60),
  purpose text NOT NULL,
  is_international boolean NOT NULL DEFAULT false,
  room_type_id text NOT NULL,
  id_front_path text NOT NULL DEFAULT '',
  id_back_path text NOT NULL DEFAULT '',
  visa_path text,
  policy_accepted_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'checked_in', 'cancelled')),
  visitor_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.be_self_check_ins TO authenticated;
GRANT ALL ON public.be_self_check_ins TO service_role;
ALTER TABLE public.be_self_check_ins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.be_is_checkin_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = (select auth.uid()) AND u.email_confirmed_at IS NOT NULL AND (
      (lower(u.email) = 'admin@xtsy.one' AND public.has_role(u.id, 'admin'::public.app_role)) OR
      (lower(u.email) = 'booking@xtsy.one' AND public.has_role(u.id, 'staff'::public.app_role))
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.be_is_checkin_staff() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.be_is_checkin_staff() TO authenticated, service_role;

CREATE POLICY be_self_check_ins_staff_read ON public.be_self_check_ins FOR SELECT TO authenticated USING ((select public.be_is_checkin_staff()));
CREATE POLICY be_self_check_ins_staff_update ON public.be_self_check_ins FOR UPDATE TO authenticated USING ((select public.be_is_checkin_staff())) WITH CHECK ((select public.be_is_checkin_staff()));
CREATE INDEX be_self_check_ins_created_idx ON public.be_self_check_ins (created_at DESC);
CREATE INDEX be_self_check_ins_visitor_created_idx ON public.be_self_check_ins (visitor_hash, created_at DESC);
CREATE INDEX be_self_check_ins_property_created_idx ON public.be_self_check_ins (property_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.assign_front_desk_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'booking@xtsy.one' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff'::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.assign_front_desk_role() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_front_desk_role() TO service_role;
DROP TRIGGER IF EXISTS assign_front_desk_role_on_signup ON auth.users;
CREATE TRIGGER assign_front_desk_role_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_front_desk_role();
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'staff'::public.app_role FROM auth.users WHERE lower(email) = 'booking@xtsy.one'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE POLICY guest_identity_documents_staff_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'guest-identity-documents' AND (select public.be_is_checkin_staff()));
CREATE POLICY guest_identity_documents_staff_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'guest-identity-documents' AND (select public.be_is_checkin_staff()));