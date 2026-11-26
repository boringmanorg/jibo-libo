import { createFileRoute } from '@tanstack/react-router';

// ZimmerStack posts a signed event (OTA booking, channel alert). Verified on the raw body with
// ZIMMERSTACK_WEBHOOK_SECRET; then the hotel's event log is read from the saved place.
export const Route = createFileRoute('/api/public/hooks/zimmerstack')({
  server: { handlers: {
    POST: async ({ request }) => {
      const { handleZimmerstackWebhook } = await import('@/booking/channel/zimmerstack.server');
      const { getServiceClient } = await import('@/admin/serviceClient.server');
      return handleZimmerstackWebhook(request, { db: getServiceClient(), env: process.env, now: new Date() });
    },
    GET: () =>
      new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'POST', 'x-robots-tag': 'noindex, nofollow', 'content-type': 'text/plain' },
      }),
  } },
});
