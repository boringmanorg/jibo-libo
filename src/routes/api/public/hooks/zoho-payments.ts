import { createFileRoute } from '@tanstack/react-router';

/** Zoho Payments webhook. Register https://xtsy.one/api/public/hooks/zoho-payments in Zoho. */
export const Route = createFileRoute('/api/public/hooks/zoho-payments')({
  server: { handlers: {
    POST: async ({ request }) => {
      const rawBody = await request.text();
      const { handlePaymentWebhook } = await import('@/booking/publicEngine.core');
      const { getServiceClient } = await import('@/admin/serviceClient.server');
      const r = await handlePaymentWebhook({ db: getServiceClient(), env: process.env, now: new Date() }, rawBody, request.headers);
      return new Response(r.body, { status: r.status, headers: { 'content-type': 'text/plain', 'x-robots-tag': 'noindex, nofollow' } });
    },
    GET: () =>
      new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'POST', 'x-robots-tag': 'noindex, nofollow', 'content-type': 'text/plain' },
      }),
  } },
});
