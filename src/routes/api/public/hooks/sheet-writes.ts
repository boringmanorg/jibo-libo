import { createFileRoute } from '@tanstack/react-router';

// The owner's Google Sheet collects OTA and website bookings to write in (see scripts/google-sheet/).
export const Route = createFileRoute('/api/public/hooks/sheet-writes')({
  server: { handlers: {
    POST: async ({ request }) => {
      const { handleSheetWrites } = await import('@/booking/sheetSync.server');
      return handleSheetWrites(request);
    },
    GET: () =>
      new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'POST', 'x-robots-tag': 'noindex, nofollow', 'content-type': 'text/plain' },
      }),
  } },
});
