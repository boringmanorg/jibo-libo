DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('check_idempotency','calculate_readiness_score','approve_enquiry','classify_traveller_segment','calculate_spend_tier','get_user_properties','check_suspicious_booking_activity','create_booking_with_invoice','check_newsletter_rate_limit','approve_booking_and_block_inventory','deny_booking_with_message','generate_password_reset_otp','cleanup_expired_otp','move_to_dlq','read_email_batch','enqueue_email','delete_email')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    IF r.proname IN ('move_to_dlq','read_email_batch','enqueue_email','delete_email') THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pgmq', r.sig);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON TABLE public.password_reset_otp FROM anon, authenticated;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='password_reset_otp' LOOP
    EXECUTE format('DROP POLICY %I ON public.password_reset_otp', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.password_reset_otp ENABLE ROW LEVEL SECURITY;