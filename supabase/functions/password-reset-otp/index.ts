/**
 * Password Reset OTP Edge Function: RETIRED.
 *
 * The emailed 6-digit code could be guessed without limit within its 2-minute window, letting
 * anyone take over an account (including staff accounts). XTSY has no public sign-in, so
 * self-service reset is switched off. Staff passwords are reset from Lovable -> Cloud -> Users.
 *
 * Every action now returns 410 Gone without generating, sending, verifying or changing anything.
 * The previous implementation is in git history (before this commit) if it is ever needed.
 */

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Password reset is not available. Email admin@xtsy.one and the XTSY desk will help you.',
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
