/**
 * Zoho Payments (India) adapter. Server-only: keys come from server secrets, never the browser.
 *
 * From Zoho's developer docs (checked 19 Nov 2026):
 * - Payment sessions: POST /api/v1/paymentsessions, valid up to 900 s, can restrict payment methods;
 *   with hosted page parameters the response carries an access_key for
 *   https://payments.zoho.in/hostedcheckout/<access_key>.
 * - Payment links (75% balance): POST /api/v1/paymentlinks.
 * - Webhooks: header X-Zoho-Webhook-Signature "t=<ms>,v=<hmac>", HMAC-SHA256 of "<t>.<raw body>".
 * - Redirects: HMAC-SHA256 of the dot-joined return parameters, compared with `signature`.
 * Zoho India accepts India-issued cards only, in INR, per its help page: foreign cards need a second gateway.
 * TO CONFIRM IN SANDBOX: the hosted-page object's key name (the API reference says
 * hosted_page_parameters; the hosted-checkout guide says hosted_checkout_parameters) and the
 * webhook payload's field names, which Zoho does not document. Webhooks are only a trigger here:
 * status is always re-read with getSession().
 */
import type { Paise } from '../money';
import { GATEWAY_METHOD } from './fees';
import type { Checkout, CheckoutRequest, PaymentGateway, PaymentLink, PaymentLinkRequest, SessionState, SessionStatus, WebhookPointer } from './gateway';
import { hmacSha256Hex, safeEqual } from './crypto';

export interface ZohoConfig {
  accountId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Signing key of the webhook (shown on the webhook's page in Zoho). */
  webhookSigningKey: string;
  /** Signing key under Authentication Keys, used for redirect signatures. */
  redirectSigningKey: string;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const API = 'https://payments.zoho.in/api/v1';
const ACCOUNTS = 'https://accounts.zoho.in/oauth/v2/token';
export const HOSTED_PARAMS_FIELD = 'hosted_page_parameters';
export const WEBHOOK_TOLERANCE_MS = 5 * 60_000;

const toRupees = (p: Paise) => Math.round(p) / 100;

/** Reads the six Zoho values from server environment; null when any is missing (gateway stays off). */
export function zohoConfigFromEnv(env: Record<string, string | undefined>): ZohoConfig | null {
  const cfg = {
    accountId: env['ZOHO_PAYMENTS_ACCOUNT_ID'],
    clientId: env['ZOHO_PAYMENTS_CLIENT_ID'],
    clientSecret: env['ZOHO_PAYMENTS_CLIENT_SECRET'],
    refreshToken: env['ZOHO_PAYMENTS_REFRESH_TOKEN'],
    webhookSigningKey: env['ZOHO_PAYMENTS_WEBHOOK_SIGNING_KEY'],
    redirectSigningKey: env['ZOHO_PAYMENTS_REDIRECT_SIGNING_KEY'],
  };
  return Object.values(cfg).every((v) => typeof v === 'string' && v.length > 0) ? (cfg as ZohoConfig) : null;
}

/** Finds the first value for any of `keys` anywhere in a parsed JSON payload. */
function findDeep(node: unknown, keys: string[]): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (keys.includes(k) && (typeof v === 'string' || typeof v === 'number')) return String(v);
  }
  for (const v of Object.values(node as Record<string, unknown>)) {
    const hit = findDeep(v, keys);
    if (hit) return hit;
  }
  return undefined;
}

const STATUS: Record<string, SessionStatus> = { succeeded: 'succeeded', success: 'succeeded', failed: 'failed', expired: 'expired', pending: 'pending', initiated: 'pending' };

export function createZohoGateway(cfg: ZohoConfig, deps: { fetch: Fetch; now: () => number } = { fetch: (i, n) => fetch(i, n), now: () => Date.now() }): PaymentGateway {
  let token: { value: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt - 60_000 > deps.now()) return token.value;
    const body = new URLSearchParams({ refresh_token: cfg.refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token' });
    const res = await deps.fetch(ACCOUNTS, { method: 'POST', body });
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!res.ok || !json.access_token) throw new Error('Zoho Payments sign-in failed');
    token = { value: json.access_token, expiresAt: deps.now() + (json.expires_in ?? 3600) * 1000 };
    return token.value;
  }

  async function call<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
    const sep = path.includes('?') ? '&' : '?';
    const res = await deps.fetch(`${API}${path}${sep}account_id=${encodeURIComponent(cfg.accountId)}`, {
      method: init.method,
      headers: { Authorization: `Zoho-oauthtoken ${await accessToken()}`, 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const json = (await res.json()) as T & { code?: number; message?: string };
    if (!res.ok || (typeof json.code === 'number' && json.code !== 0)) throw new Error(`Zoho Payments: ${json.message ?? res.status}`);
    return json;
  }

  return {
    id: 'zoho',

    async createCheckout(req: CheckoutRequest): Promise<Checkout> {
      const out = await call<{ payments_session: { payments_session_id: string; access_key?: string } }>('/paymentsessions', {
        method: 'POST',
        body: {
          amount: toRupees(req.amount),
          currency: 'INR',
          description: req.description,
          reference_number: req.reference,
          expires_in: Math.min(900, Math.max(300, req.expiresInSeconds)),
          // Booking reference only: Zoho asks for no personal data in meta_data.
          meta_data: [{ key: 'booking', value: req.reference }],
          configurations: {
            allowed_payment_methods: [GATEWAY_METHOD[req.method]],
            [HOSTED_PARAMS_FIELD]: { description: req.description, success_url: req.successUrl, failure_url: req.failureUrl },
          },
        },
      });
      const s = out.payments_session;
      if (!s?.access_key) throw new Error('Zoho Payments did not return a hosted checkout');
      return { sessionId: s.payments_session_id, redirectUrl: `https://payments.zoho.in/hostedcheckout/${s.access_key}` };
    },

    async createPaymentLink(req: PaymentLinkRequest): Promise<PaymentLink> {
      const out = await call<{ payment_links: { payment_link_id: string; url: string } }>('/paymentlinks', {
        method: 'POST',
        body: {
          amount: toRupees(req.amount),
          currency: 'INR',
          description: req.description,
          reference_id: req.reference,
          expires_at: req.expiresOn,
          ...(req.method ? { configurations: { allowed_payment_methods: [GATEWAY_METHOD[req.method] === 'netbanking' ? 'net_banking' : GATEWAY_METHOD[req.method]] } } : {}),
        },
      });
      return { linkId: out.payment_links.payment_link_id, url: out.payment_links.url };
    },

    async getSession(sessionId: string): Promise<SessionState> {
      const out = await call<{ payments_session: { status?: string; amount?: number; payments?: { payment_id: string }[] } }>(`/paymentsessions/${encodeURIComponent(sessionId)}`, { method: 'GET' });
      const s = out.payments_session;
      return {
        status: STATUS[(s.status ?? '').toLowerCase()] ?? 'unknown',
        paymentIds: (s.payments ?? []).map((p) => p.payment_id),
        amount: Math.round((s.amount ?? 0) * 100),
      };
    },

    async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookPointer | null> {
      const header = headers.get('x-zoho-webhook-signature');
      if (!header) return null;
      const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=', 2) as [string, string]));
      const t = Number(parts['t']);
      if (!parts['v'] || !Number.isFinite(t) || Math.abs(deps.now() - t) > WEBHOOK_TOLERANCE_MS) return null;
      const expected = await hmacSha256Hex(cfg.webhookSigningKey, `${parts['t']}.${rawBody}`);
      if (!safeEqual(expected, parts['v'])) return null;
      let json: unknown;
      try { json = JSON.parse(rawBody); } catch { return null; }
      return {
        sessionId: findDeep(json, ['payments_session_id']),
        linkId: findDeep(json, ['payment_link_id']),
        paymentId: findDeep(json, ['payment_id']),
      };
    },

    async verifyReturn(params: URLSearchParams): Promise<boolean> {
      const signature = params.get('signature');
      if (!signature) return false;
      const fields = ['payments_session_id', 'payment_session_status', 'payment_id', 'payment_status', 'amount', 'mandate_id', 'udf1', 'udf2', 'udf3', 'udf4', 'udf5'];
      const message = fields.map((f) => params.get(f) ?? '').join('.');
      return safeEqual(await hmacSha256Hex(cfg.redirectSigningKey, message), signature);
    },
  };
}
