import { createFileRoute } from '@tanstack/react-router';

/**
 * GET /api/public/pms-feed: what Hostel POS (posbyxtsy.club) pulls on each sync. Room types, beds
 * and free counts only; all of it already public on /book (src/booking/pmsFeed.ts). Read-only,
 * no guest data, never cached.
 */
const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'x-robots-tag': 'noindex, nofollow',
};

export const Route = createFileRoute('/api/public/pms-feed')({
  server: { handlers: {
    GET: async () => {
      const { pmsFeed } = await import('@/booking/publicEngine.core');
      const { getServiceClient } = await import('@/admin/serviceClient.server');
      try {
        const feed = await pmsFeed({ db: getServiceClient(), env: process.env, now: new Date() });
        return new Response(JSON.stringify(feed), { status: 200, headers });
      } catch {
        return new Response(JSON.stringify({ error: 'The booking engine could not read its counts just now.' }), { status: 503, headers });
      }
    },
    OPTIONS: () => new Response(null, { status: 204, headers }),
  } },
});
