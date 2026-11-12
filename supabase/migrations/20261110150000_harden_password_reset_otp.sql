-- Security fix: "Anyone can take over an account through password reset".
--
-- verify_password_reset_otp accepted unlimited wrong guesses, so a 6-digit code could be
-- brute-forced inside its 2-minute window. Self-service reset is retired (the password-reset-otp
-- edge function now returns 410), and as a backstop this:
--   1. makes any wrong guess burn every outstanding code for that email, so a code can't be
--      brute-forced even if the function is ever re-enabled;
--   2. invalidates all codes issued so far.
-- CREATE OR REPLACE keeps the function's existing owner and grants (backend-only execution).

CREATE OR REPLACE FUNCTION public.verify_password_reset_otp(p_email text, p_otp text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record record;
BEGIN
  SELECT * INTO v_record
  FROM public.password_reset_otp
  WHERE email = p_email
    AND otp_code = p_otp
    AND used = false
    AND expires_at > now()
  LIMIT 1;

  IF v_record IS NULL THEN
    -- One wrong guess invalidates every outstanding code for this email.
    UPDATE public.password_reset_otp SET used = true
    WHERE email = p_email AND used = false;
    RETURN json_build_object('success', false, 'error', 'Invalid or expired OTP');
  END IF;

  UPDATE public.password_reset_otp SET used = true
  WHERE email = p_email AND used = false;

  RETURN json_build_object('success', true, 'user_id', v_record.user_id);
END;
$$;

UPDATE public.password_reset_otp SET used = true WHERE used = false;
