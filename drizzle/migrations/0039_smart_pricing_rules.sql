CREATE TABLE public.be_smart_pricing (
  room_type_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  min_rupees integer NOT NULL CHECK (min_rupees > 0),
  max_rupees integer NOT NULL CHECK (max_rupees >= min_rupees),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.be_smart_pricing TO authenticated;
GRANT ALL ON public.be_smart_pricing TO service_role;
ALTER TABLE public.be_smart_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY be_smart_pricing_super_select ON public.be_smart_pricing FOR SELECT TO authenticated USING ((select public.is_super_admin()));
CREATE POLICY be_smart_pricing_super_insert ON public.be_smart_pricing FOR INSERT TO authenticated WITH CHECK ((select public.is_super_admin()));
CREATE POLICY be_smart_pricing_super_update ON public.be_smart_pricing FOR UPDATE TO authenticated USING ((select public.is_super_admin())) WITH CHECK ((select public.is_super_admin()));
CREATE POLICY be_smart_pricing_super_delete ON public.be_smart_pricing FOR DELETE TO authenticated USING ((select public.is_super_admin()));