/**
 * Cloudflare Turnstile check for checkout, so bots cannot hold rooms or open payment sessions.
 * Keys live in the server environment: TURNSTILE_SITE_KEY (public, shown to the browser) and
 * TURNSTILE_SECRET_KEY (server only). Create both in Cloudflare → Turnstile for xtsy.one.
 */
export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type Env = Record<string, string | undefined>;
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export const botCheckConfigured = (env: Env): boolean => Boolean(env['TURNSTILE_SITE_KEY'] && env['TURNSTILE_SECRET_KEY']);

/** The public half, for the browser widget. */
export const botCheckSiteKey = (env: Env): string | null => (botCheckConfigured(env) ? env['TURNSTILE_SITE_KEY']! : null);

export async function verifyBotCheck(env: Env, token: string | undefined, remoteIp: string | undefined, fetchFn: Fetch = (i, n) => fetch(i, n)): Promise<boolean> {
  const secret = env['TURNSTILE_SECRET_KEY'];
  if (!secret || !token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const res = await fetchFn(SITEVERIFY_URL, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) return false;
    const out = (await res.json()) as { success?: boolean; hostname?: string };
    return out.success === true;
  } catch {
    return false;
  }
}
