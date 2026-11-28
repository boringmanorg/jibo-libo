CREATE TABLE public.be_live_events (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL,
  property_id text NOT NULL CHECK (property_id ~ '^[A-Z0-9-]{3,40}$'),
  stage text NOT NULL CHECK (stage IN ('view', 'rooms', 'details', 'contacted')),
  reference text CHECK (reference IS NULL OR reference ~ '^XTSY-[A-Z0-9]{5}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX be_live_events_property_time ON public.be_live_events (property_id, created_at DESC);
GRANT SELECT ON public.be_live_events TO authenticated;
GRANT ALL ON public.be_live_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.be_live_events_id_seq TO service_role;
ALTER TABLE public.be_live_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY be_live_events_console_read ON public.be_live_events FOR SELECT TO authenticated USING (public.be_is_console_admin());

CREATE OR REPLACE FUNCTION public.be_live_events_ring() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.send('{}'::jsonb, 'moved', 'live-insights', false);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.be_live_events_ring() FROM public, anon, authenticated;
CREATE TRIGGER be_live_events_ring AFTER INSERT ON public.be_live_events FOR EACH STATEMENT EXECUTE FUNCTION public.be_live_events_ring();