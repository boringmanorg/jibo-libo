import { createFileRoute } from '@tanstack/react-router';

// A Google Sheet asks to connect; the owner approves its pairing code in the console.
export const Route = createFileRoute('/api/public/hooks/sheet-pair')({
  server: { handlers: {
    POST: async ({ request }) => {
      const { handleSheetPair } = await import('@/booking/sheetSync.server');
      return handleSheetPair(request);
    },
    GET: () =>
      new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'POST', 'x-robots-tag': 'noindex, nofollow', 'content-type': 'text/plain' },
      }),
  } },
});
