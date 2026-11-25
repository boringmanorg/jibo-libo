import { createFileRoute } from '@tanstack/react-router';

/**
 * Zoho OAuth return address (registered in the Zoho API Console). The permanent refresh token is
 * already saved as a server secret, so this page only confirms receipt: it never stores, exchanges
 * or echoes the one-time code, so a stray visit cannot change the payment credentials.
 */
const headers = { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' };

export const Route = createFileRoute('/api/public/hooks/zoho-oauth')({
  server: { handlers: {
    GET: ({ request }) => {
      const url = new URL(request.url);
      const ok = url.searchParams.has('code') && !url.searchParams.has('error');
      return new Response(
        ok ? 'Zoho authorisation received. You can close this tab; the XTSY team will finish the setup.' : 'Zoho authorisation was not completed. Please try again from the Zoho console.',
        { status: ok ? 200 : 400, headers },
      );
    },
  } },
});
