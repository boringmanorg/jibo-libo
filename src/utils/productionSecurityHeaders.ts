/**
 * Production Security Headers for EU/GDPR Compliance
 * Implements HSTS, CSP, and privacy-focused security headers
 */

export interface SecurityHeadersConfig {
  isDevelopment?: boolean;
  customDomains?: string[];
  enableHSTS?: boolean;
}

export function generateProductionSecurityHeaders(config: SecurityHeadersConfig = {}) {
  const {
    isDevelopment = import.meta.env.MODE === 'development',
    customDomains = [],
    enableHSTS = !isDevelopment
  } = config;

  const headers: Record<string, string> = {
    // Content Security Policy - GTM/GA4/Google Ads Compatible
    // Allows Google Tag Manager as sole analytics authority
    'Content-Security-Policy': [
      "default-src 'self'",
      // Images: Allow Google tracking pixels + general https
      "img-src 'self' data: blob: https:",
      // Styles: Allow Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.googletagmanager.com https://tagmanager.google.com",
      // Fonts: Google Fonts
      "font-src 'self' data: https://fonts.gstatic.com https://*.hotjar.com",
      // Scripts: GTM, GA4, Google Ads (inline needed for GTM to inject tags).
      // 'self' covers the first-party /cs/uxa proxy path; Contentsquare/Hotjar kept as fallback origins.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.googletagmanager.com https://tagmanager.google.com https://www.google-analytics.com https://ssl.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.googlesyndication.com https://pagead2.googlesyndication.com https://adservice.google.com https://www.gstatic.com https://ssl.gstatic.com https://www.google.com https://www.google.co.in https://tagassistant.google.com https://t.contentsquare.net https://*.contentsquare.net https://script.hotjar.com https://static.hotjar.com",
      // Connect: analytics + Contentsquare/Hotjar beacons + Sentry error
      // reports (without the Sentry ingest hosts every crash report was blocked by this policy).
      `connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://region1.google-analytics.com https://www.googletagmanager.com https://*.googletagmanager.com https://tagassistant.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://stats.g.doubleclick.net https://td.doubleclick.net https://*.g.doubleclick.net https://adservice.google.com https://www.google.com https://www.google.co.in https://pagead2.googlesyndication.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://fonts.googleapis.com https://fonts.gstatic.com https://t.contentsquare.net https://*.contentsquare.net https://*.hotjar.com https://*.hotjar.io https://*.doubleclick.net wss://*.hotjar.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://ipapi.co`,
      // Frames: Allow GTM preview/debug mode
      "frame-src 'self' https://www.googletagmanager.com https://tagassistant.google.com https://td.doubleclick.net https://*.doubleclick.net https://www.google.com https://*.hotjar.com",
      "frame-ancestors 'self' https://tagassistant.google.com https://tagmanager.google.com",
      "base-uri 'self'",
      "form-action 'self'",
      // public/_headers always declared object-src 'none'; the generator had
      // omitted it, leaving same-origin <object>/<embed> allowed via default-src.
      "object-src 'none'",
      "upgrade-insecure-requests"
    ].join('; '),

    // Referrer Policy - No referrer for maximum privacy
    'Referrer-Policy': 'no-referrer',

    // Permissions Policy - Restrict browser features
    'Permissions-Policy': [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
      'bluetooth=()'
    ].join(', '),

    // Content Type Options
    'X-Content-Type-Options': 'nosniff',

    // Frame Options
    'X-Frame-Options': 'DENY',

    // XSS Protection
    'X-XSS-Protection': '1; mode=block',

    // Cache Control for sensitive pages
    'Cache-Control': 'no-cache, no-store, must-revalidate, private',

    // GDPR-compliant privacy headers
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };

  // HSTS only in production to avoid localhost issues
  if (enableHSTS && !isDevelopment) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}

/**
 * Apply security headers to Response (for Edge Functions)
 */
export function withProductionSecurityHeaders(
  response: Response, 
  config: SecurityHeadersConfig = {}
): Response {
  const securityHeaders = generateProductionSecurityHeaders(config);
  const newHeaders = new Headers(response.headers);
  
  Object.entries(securityHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * The headers every server-rendered HTML response carries, applied in src/server.ts.
 *
 * The full Content-Security-Policy is served here as a real response header. It
 * used to arrive as a <meta> tag injected from a useEffect, which is after
 * hydration — by then the document and its scripts have already loaded, so the
 * policy protected nothing on first load. A header governs the page from the
 * first byte, and unlike meta it may carry frame-ancestors.
 *
 * generateProductionSecurityHeaders() also proposes non-CSP headers; those are
 * deliberately NOT adopted here, because each would break the site as it is:
 *   - 'Cache-Control: no-store' would disable all page caching,
 *   - 'Cross-Origin-Embedder-Policy: require-corp' blocks every third-party
 *     resource that lacks CORP headers (GTM, Google Fonts),
 *   - 'X-Frame-Options: DENY' contradicts the CSP's own frame-ancestors
 *     allowance for Tag Assistant,
 *   - 'Referrer-Policy: no-referrer' strips attribution analytics relies on.
 * Only its CSP is the source of truth.
 */
export function serverOnlySecurityHeaders(config: SecurityHeadersConfig = {}): Record<string, string> {
  const csp = generateProductionSecurityHeaders(config)['Content-Security-Policy'] ||
    "default-src 'self'; frame-ancestors 'self'";
  return {
    'Content-Security-Policy': csp,
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    // public/_headers declares these, but that file only covers static assets —
    // server-rendered HTML never received them, which is every page on the site.
    // Both are header-only (no meta equivalent that works), so they belong here.
    // Mirrors the policy public/_headers already declares. That file only covers
    // static assets, so HTML responses carried no HSTS at all.
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), bluetooth=(), interest-cohort=()',
  };
}

/**
 * CORS headers for API endpoints
 */
export const secureCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin, Authorization'
};