// List of allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://xtsy.one',
  'https://www.xtsy.one',
  'https://xtsy-one.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];


// Exact origins of this project only (no wildcard hosting suffixes), for functions
// that must not be callable from other sites.
const PROJECT_ORIGINS = new Set([
  ...ALLOWED_ORIGINS,
  'https://id-preview--9a4a5e4b-f1f1-40f7-ba6f-5d944df4e08e.lovable.app',
  'https://project--9a4a5e4b-f1f1-40f7-ba6f-5d944df4e08e.lovable.app',
  'https://9a4a5e4b-f1f1-40f7-ba6f-5d944df4e08e.lovableproject.com',
]);

/**
 * Get CORS headers with validated origin
 * Returns appropriate headers based on request origin
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  
  // Check if origin is in allowed list or matches allowed domain suffixes
  // Exact project origins only; any other Lovable-hosted site is not trusted.
  const isAllowedOrigin = PROJECT_ORIGINS.has(origin);
  
  const corsOrigin = isAllowedOrigin ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}


export function isProjectOrigin(req: Request): boolean {
  return PROJECT_ORIGINS.has(req.headers.get('origin') || '');
}

/** Refuses browser calls from any other website; calls without an Origin (backend jobs) pass. */
export function rejectForeignOrigin(req: Request, headers: Record<string, string>): Response | null {
  const origin = req.headers.get('origin');
  if (!origin || PROJECT_ORIGINS.has(origin)) return null;
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

/** CORS headers that only echo this project's exact origins. */
export function getStrictCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': PROJECT_ORIGINS.has(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

/**
 * Legacy export for backwards compatibility
 * @deprecated Use getCorsHeaders(req) instead for proper origin validation
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
