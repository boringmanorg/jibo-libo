CREATE TABLE public.be_rate_overrides (
  room_type_id text NOT NULL,
  night date NOT NULL,
  rupees integer NOT NULL CHECK (rupees BETWEEN 1 AND 100000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (room_type_id, night)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.be_rate_overrides TO authenticated;
GRANT ALL ON public.be_rate_overrides TO service_role;
ALTER TABLE public.be_rate_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY be_rate_overrides_super_select ON public.be_rate_overrides FOR SELECT TO authenticated USING ((SELECT public.is_super_admin()));
CREATE POLICY be_rate_overrides_super_insert ON public.be_rate_overrides FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_super_admin()));
CREATE POLICY be_rate_overrides_super_update ON public.be_rate_overrides FOR UPDATE TO authenticated USING ((SELECT public.is_super_admin())) WITH CHECK ((SELECT public.is_super_admin()));
CREATE POLICY be_rate_overrides_super_delete ON public.be_rate_overrides FOR DELETE TO authenticated USING ((SELECT public.is_super_admin()));