import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/hooks/bistro-google-sync')({
  server: { handlers: {
    POST: async ({ request }) => {
      const { handleBistroGoogleSync } = await import('@/lib/bistroGoogleSync.server');
      return handleBistroGoogleSync(request);
    },
    // Without this, a GET fell through to the SPA shell and returned 200 with a
    // full HTML page carrying "robots: index, follow" and no title or canonical —
    // an API endpoint crawlable as a (thin, duplicate) page.
    GET: () =>
      new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'POST', 'x-robots-tag': 'noindex, nofollow', 'content-type': 'text/plain' },
      }),
  } },
});