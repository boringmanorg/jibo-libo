-- Property-scoped console team: property admins and front-desk logins, set up by the super admin
-- or the property's admin. Writes go through server functions with the service role only.
CREATE TABLE public.be_property_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id text NOT NULL CHECK (property_id IN ('XTSY-SHL-HOSTEL','XTSY-SHN-CAMP')),
  role text NOT NULL CHECK (role IN ('property_admin','front_desk')),
  email text NOT NULL,
  display_name text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);
CREATE INDEX be_property_staff_property_idx ON public.be_property_staff (property_id, role);
GRANT SELECT ON public.be_property_staff TO authenticated;
GRANT ALL ON public.be_property_staff TO service_role;
ALTER TABLE public.be_property_staff ENABLE ROW LEVEL SECURITY;

-- Per-property switch for front-desk logins (on by default).
ALTER TABLE public.be_property_profiles ADD COLUMN IF NOT EXISTS desk_logins_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.be_staff_role(p_property_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.role FROM public.be_property_staff s
  WHERE s.user_id = (select auth.uid()) AND s.property_id = p_property_id AND s.active
    AND (s.role = 'property_admin' OR coalesce((SELECT p.desk_logins_enabled FROM public.be_property_profiles p WHERE p.property_id = p_property_id), true))
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.be_staff_role(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.be_staff_role(text) TO authenticated, service_role;

-- Every property the signed-in user may open in the console, with their role there.
CREATE OR REPLACE FUNCTION public.be_my_console_access()
RETURNS TABLE(property_id text, role text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, 'super'::text FROM (VALUES ('XTSY-SHL-HOSTEL'),('XTSY-SHN-CAMP')) AS p(id) WHERE public.is_super_admin()
  UNION ALL
  SELECT s.property_id, public.be_staff_role(s.property_id) FROM public.be_property_staff s
  WHERE NOT public.is_super_admin() AND s.user_id = (select auth.uid()) AND public.be_staff_role(s.property_id) IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.be_my_console_access() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.be_my_console_access() TO authenticated, service_role;

CREATE POLICY be_property_staff_read ON public.be_property_staff FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.is_super_admin()) OR public.be_staff_role(property_id) = 'property_admin');

-- The hostel admin is now whoever holds an active property_admin row for the hostel (booking@xtsy.one seeded below).
CREATE OR REPLACE FUNCTION public.be_is_checkin_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = (select auth.uid()) AND u.email_confirmed_at IS NOT NULL AND (
      (lower(u.email) = 'admin@xtsy.one' AND public.has_role(u.id, 'admin'::public.app_role)) OR
      public.be_staff_role('XTSY-SHL-HOSTEL') = 'property_admin'
    )
  );
$$;

-- Check-in records and identity documents: super admin, or any active staff of that property.
CREATE OR REPLACE FUNCTION public.be_can_access_checkin_property(p_property_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
 SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = (select auth.uid()) AND u.email_confirmed_at IS NOT NULL AND (
 (lower(u.email) = 'admin@xtsy.one' AND public.has_role(u.id, 'admin'::public.app_role)) OR
 public.be_staff_role(p_property_id) IS NOT NULL));
$$;

-- Front desk may hold and release rooms for a check-in (blocks labelled "Check-in …") and nothing else.
CREATE POLICY desk_holds_checkin_rooms_insert ON public.console_inventory_overrides FOR INSERT TO authenticated
  WITH CHECK (state = 'blocked' AND reason LIKE 'Check-in %' AND public.be_staff_role(property_id) = 'front_desk');
CREATE POLICY desk_releases_checkin_rooms_delete ON public.console_inventory_overrides FOR DELETE TO authenticated
  USING (state = 'blocked' AND reason LIKE 'Check-in %' AND public.be_staff_role(property_id) = 'front_desk');
CREATE POLICY desk_reads_checkin_rooms ON public.console_inventory_overrides FOR SELECT TO authenticated
  USING (public.be_staff_role(property_id) = 'front_desk');
ALTER POLICY "super admin writes audit" ON public.console_audit_log
  WITH CHECK ((actor = (select auth.uid())) AND ((select public.is_super_admin()) OR (select public.be_is_checkin_staff()) OR EXISTS (SELECT 1 FROM public.be_property_staff s WHERE s.user_id = (select auth.uid()) AND s.active)));

INSERT INTO public.be_property_staff (user_id, property_id, role, email, display_name)
SELECT u.id, 'XTSY-SHL-HOSTEL', 'property_admin', lower(u.email), 'XTSY Travellers Hostel admin'
FROM auth.users u WHERE lower(u.email) = 'booking@xtsy.one'
ON CONFLICT (user_id, property_id) DO NOTHING;

-- Search-demand readings from Google search appearances, taken when the super admin presses refresh.
CREATE TABLE public.be_demand_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL,
  window_end date NOT NULL,
  recent_impressions integer NOT NULL DEFAULT 0,
  baseline_weekly integer NOT NULL DEFAULT 0,
  ratio numeric NOT NULL DEFAULT 1,
  multiplier numeric NOT NULL DEFAULT 1 CHECK (multiplier BETWEEN 0.9 AND 1.15),
  top_queries jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX be_demand_snapshots_property_idx ON public.be_demand_snapshots (property_id, captured_at DESC);
GRANT SELECT ON public.be_demand_snapshots TO authenticated;
GRANT ALL ON public.be_demand_snapshots TO service_role;
ALTER TABLE public.be_demand_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY be_demand_snapshots_read ON public.be_demand_snapshots FOR SELECT TO authenticated
  USING ((select public.is_super_admin()) OR public.be_staff_role(property_id) = 'property_admin');