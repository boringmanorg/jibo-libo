import { createFileRoute } from '@tanstack/react-router';

// Receives date-wise room availability from the owner's Google Sheet (see scripts/google-sheet/).
export const Route = createFileRoute('/api/public/hooks/sheet-availability')({
  server: { handlers: {
    POST: async ({ request }) => {
      const { handleSheetAvailability } = await import('@/booking/sheetSync.server');
      return handleSheetAvailability(request);
    },
    GET: () =>
      new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'POST', 'x-robots-tag': 'noindex, nofollow', 'content-type': 'text/plain' },
      }),
  } },
});
