import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createZohoGateway, zohoConfigFromEnv, type ZohoConfig } from '@/booking/payments/zoho.server';
import { webhookKey } from '@/booking/payments/gateway';

const cfg: ZohoConfig = {
  accountId: 'acc1', clientId: 'cid', clientSecret: 'csec', refreshToken: 'rt',
  webhookSigningKey: 'whk-test', redirectSigningKey: 'rdk-test',
};
const NOW = 1_795_000_000_000;
// Independent of the adapter's own helper: Node's crypto computes the expected signatures.
const sign = (k: string, m: string) => createHmac('sha256', k).update(m).digest('hex');

function fakeZoho(responses: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const key = Object.keys(responses).find((k) => url.includes(k))!;
    return new Response(JSON.stringify(responses[key]), { status: 200 });
  };
  return { calls, gateway: createZohoGateway(cfg, { fetch, now: () => NOW }) };
}
const token = { 'oauth/v2/token': { access_token: 'tok', expires_in: 3600 } };

describe('Zoho Payments checkout', () => {
  it('opens a hosted checkout limited to the chosen method, in rupees, with no personal data', async () => {
    const { calls, gateway } = fakeZoho({ ...token, '/paymentsessions': { code: 0, payments_session: { payments_session_id: 'ps_1', access_key: 'ak_1' } } });
    const out = await gateway.createCheckout({ reference: 'XTSY-7KQ2M', amount: 131224, description: 'Advance for XTSY-7KQ2M', method: 'credit_card', successUrl: 'https://xtsy.one/book/paid', failureUrl: 'https://xtsy.one/book/failed', expiresInSeconds: 900 });
    expect(out).toEqual({ sessionId: 'ps_1', redirectUrl: 'https://payments.zoho.in/hostedpages/ak_1' });
    expect(JSON.parse(calls.find((c) => c.url.includes('/paymentsessions'))!.init!.body as string).configurations.hosted_checkout_parameters).toEqual({ description: 'Advance for XTSY-7KQ2M', success_url: 'https://xtsy.one/book/paid', failure_url: 'https://xtsy.one/book/failed' });
    const call = calls.find((c) => c.url.includes('/paymentsessions'))!;
    expect(call.url).toContain('account_id=acc1');
    expect((call.init!.headers as Record<string, string>).Authorization).toBe('Zoho-oauthtoken tok');
    const body = JSON.parse(call.init!.body as string);
    expect(body.amount).toBe(1312.24);
    expect(body.currency).toBe('INR');
    expect(body.expires_in).toBe(900);
    expect(body.configurations.allowed_payment_methods).toEqual(['card']);
    expect(body.meta_data).toEqual([{ key: 'booking', value: 'XTSY-7KQ2M' }]);
  });

  it('signs in once and reuses the token', async () => {
    const { calls, gateway } = fakeZoho({ ...token, '/paymentsessions': { code: 0, payments_session: { status: 'succeeded', amount: 10, payments: [] } } });
    await gateway.getSession('a');
    await gateway.getSession('b');
    expect(calls.filter((c) => c.url.includes('oauth')).length).toBe(1);
  });

  it('reads the session status back from Zoho', async () => {
    const { gateway } = fakeZoho({ ...token, '/paymentsessions/ps_1': { code: 0, payments_session: { status: 'succeeded', amount: 1312.24, payments: [{ payment_id: 'pay_9' }] } } });
    expect(await gateway.getSession('ps_1')).toEqual({ status: 'succeeded', paymentIds: ['pay_9'], amount: 131224 });
  });

  it('creates a balance payment link restricted to UPI', async () => {
    const { calls, gateway } = fakeZoho({ ...token, '/paymentlinks': { code: 0, payment_links: { payment_link_id: 'pl_1', url: 'https://zoho.link/pl_1' } } });
    expect(await gateway.createPaymentLink({ reference: 'XTSY-7KQ2M', amount: 393671, description: 'Balance', method: 'upi', expiresOn: '2026-12-03' })).toEqual({ linkId: 'pl_1', url: 'https://zoho.link/pl_1' });
    const body = JSON.parse(calls.find((c) => c.url.includes('/paymentlinks'))!.init!.body as string);
    expect([body.amount, body.reference_id, body.configurations.allowed_payment_methods]).toEqual([3936.71, 'XTSY-7KQ2M', ['upi']]);
  });

  it('surfaces Zoho errors instead of pretending success', async () => {
    const { gateway } = fakeZoho({ ...token, '/paymentsessions': { code: 1002, message: 'Invalid amount' } });
    await expect(gateway.createCheckout({ reference: 'X', amount: 1, description: 'd', method: 'upi', successUrl: 's', failureUrl: 'f', expiresInSeconds: 900 })).rejects.toThrow(/Invalid amount/);
  });
});

describe('Zoho webhook verification', () => {
  const { gateway } = fakeZoho(token);
  const body = JSON.stringify({ event_type: 'payment.succeeded', event_object: { payment: { payment_id: 'pay_9', payments_session_id: 'ps_1', amount: 1312.24 } } });
  const header = (t: number, b = body, k = cfg.webhookSigningKey) => new Headers({ 'X-Zoho-Webhook-Signature': `t=${t},v=${sign(k, `${t}.${b}`)}` });

  it('accepts a genuine webhook and points at the session and payment', async () => {
    expect(await gateway.verifyWebhook(body, header(NOW))).toEqual({ sessionId: 'ps_1', linkId: undefined, paymentId: 'pay_9' });
  });
  it('rejects a changed body', async () => {
    expect(await gateway.verifyWebhook(body.replace('1312.24', '1.00'), header(NOW))).toBeNull();
  });
  it('rejects the wrong signing key', async () => {
    expect(await gateway.verifyWebhook(body, header(NOW, body, 'other-key'))).toBeNull();
  });
  it('rejects a replay older than 5 minutes', async () => {
    expect(await gateway.verifyWebhook(body, header(NOW - 6 * 60_000))).toBeNull();
  });
  it('rejects a request with no signature', async () => {
    expect(await gateway.verifyWebhook(body, new Headers())).toBeNull();
  });
  it('maps repeat deliveries of one event to one key', () => {
    expect(webhookKey('zoho', { sessionId: 'ps_1', paymentId: 'pay_9' })).toBe(webhookKey('zoho', { sessionId: 'ps_1', paymentId: 'pay_9' }));
  });
});

describe('Zoho redirect verification', () => {
  const { gateway } = fakeZoho(token);
  const fields = { payments_session_id: 'ps_1', payment_session_status: 'succeeded', payment_id: 'pay_9', payment_status: 'succeeded', amount: '1312.24' };
  const msg = [fields.payments_session_id, fields.payment_session_status, fields.payment_id, fields.payment_status, fields.amount, '', '', '', '', '', ''].join('.');

  it('accepts a genuine redirect', async () => {
    expect(await gateway.verifyReturn(new URLSearchParams({ ...fields, signature: sign(cfg.redirectSigningKey, msg) }))).toBe(true);
  });
  it('rejects a redirect whose status was edited in the address bar', async () => {
    // Signed for status "succeeded"; a guest who edits it in the address bar must not pass.
    const tampered = new URLSearchParams({ ...fields, payment_status: 'failed', signature: sign(cfg.redirectSigningKey, msg) });
    expect(await gateway.verifyReturn(tampered)).toBe(false);
  });
  it('rejects a redirect with no signature', async () => {
    expect(await gateway.verifyReturn(new URLSearchParams(fields))).toBe(false);
  });
});

describe('Zoho configuration', () => {
  it('stays off until all six server secrets are set', () => {
    expect(zohoConfigFromEnv({ ZOHO_PAYMENTS_ACCOUNT_ID: 'a' })).toBeNull();
    expect(zohoConfigFromEnv({
      ZOHO_PAYMENTS_ACCOUNT_ID: 'a', ZOHO_PAYMENTS_CLIENT_ID: 'b', ZOHO_PAYMENTS_CLIENT_SECRET: 'c',
      ZOHO_PAYMENTS_REFRESH_TOKEN: 'd', ZOHO_PAYMENTS_WEBHOOK_SIGNING_KEY: 'e', ZOHO_PAYMENTS_REDIRECT_SIGNING_KEY: 'f',
    })).not.toBeNull();
  });
});
