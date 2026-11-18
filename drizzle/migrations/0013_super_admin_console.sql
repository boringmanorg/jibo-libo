CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(lower(auth.jwt() ->> 'email') = 'admin@xtsy.one', false)
     AND public.has_role(auth.uid(), 'admin'::app_role)
$$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

CREATE TABLE public.console_integration_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pms_enabled boolean NOT NULL DEFAULT false,
  pos_enabled boolean NOT NULL DEFAULT false,
  live_tables_showcase boolean NOT NULL DEFAULT false,
  last_pms_sync_at timestamptz,
  last_pos_sync_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.console_integration_settings TO authenticated;
GRANT ALL ON public.console_integration_settings TO service_role;
ALTER TABLE public.console_integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages settings" ON public.console_integration_settings
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
INSERT INTO public.console_integration_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.console_inventory_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL,
  unit_type_id text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  state text NOT NULL CHECK (state IN ('blocked','open')),
  reason text,
  pms_status text NOT NULL DEFAULT 'pending' CHECK (pms_status IN ('pending','synced','failed')),
  pms_reference text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.console_inventory_overrides TO authenticated;
GRANT ALL ON public.console_inventory_overrides TO service_role;
ALTER TABLE public.console_inventory_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages inventory overrides" ON public.console_inventory_overrides
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.console_table_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id text NOT NULL,
  service_date date NOT NULL,
  slot_time text NOT NULL CHECK (slot_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  state text NOT NULL CHECK (state IN ('closed','open')),
  pos_status text NOT NULL DEFAULT 'pending' CHECK (pos_status IN ('pending','synced','failed')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outlet_id, service_date, slot_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.console_table_overrides TO authenticated;
GRANT ALL ON public.console_table_overrides TO service_role;
ALTER TABLE public.console_table_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages table overrides" ON public.console_table_overrides
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.console_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid NOT NULL DEFAULT auth.uid(),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.console_audit_log TO authenticated;
GRANT ALL ON public.console_audit_log TO service_role;
ALTER TABLE public.console_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin reads audit" ON public.console_audit_log
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super admin writes audit" ON public.console_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() AND actor = auth.uid());

INSERT INTO public.user_roles (user_id, role)
SELECT '56853300-d475-4f85-9a3c-37b13fc705aa'::uuid, 'admin'::app_role
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '56853300-d475-4f85-9a3c-37b13fc705aa'::uuid AND role = 'admin'::app_role);