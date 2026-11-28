CREATE OR REPLACE FUNCTION public.be_live_funnel(p_since timestamptz, p_active_min int DEFAULT 15, p_drop_min int DEFAULT 30)
RETURNS TABLE (property_id text, viewing_now int, rooms_now int, details_now int, visits int, chose_rooms int, reached_details int, contacted int, dropped int, refs text[])
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH v AS (
    SELECT e.property_id, e.session_id,
      max(CASE e.stage WHEN 'view' THEN 0 WHEN 'rooms' THEN 1 WHEN 'details' THEN 2 ELSE 3 END) AS best,
      max(e.created_at) AS last_at,
      max(e.reference) AS ref
    FROM public.be_live_events e
    WHERE e.created_at >= p_since
    GROUP BY e.property_id, e.session_id
  )
  SELECT v.property_id,
    count(*) FILTER (WHERE best = 0 AND last_at >= now() - make_interval(mins => p_active_min))::int,
    count(*) FILTER (WHERE best = 1 AND last_at >= now() - make_interval(mins => p_active_min))::int,
    count(*) FILTER (WHERE best = 2 AND last_at >= now() - make_interval(mins => p_active_min))::int,
    count(*)::int,
    count(*) FILTER (WHERE best >= 1)::int,
    count(*) FILTER (WHERE best >= 2)::int,
    count(*) FILTER (WHERE best = 3)::int,
    count(*) FILTER (WHERE best IN (1, 2) AND last_at < now() - make_interval(mins => p_drop_min))::int,
    coalesce(array_agg(ref) FILTER (WHERE best = 3 AND ref IS NOT NULL), '{}')
  FROM v GROUP BY v.property_id
$$;
REVOKE ALL ON FUNCTION public.be_live_funnel(timestamptz, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.be_live_funnel(timestamptz, int, int) TO authenticated, service_role;
CREATE INDEX IF NOT EXISTS be_live_events_session ON public.be_live_events (property_id, session_id);