/**
 * Server-only client for posbyxtsy.club (PMS + POS). OFF by default.
 * Enabled only when XTSY_SAAS_ENABLED === "true" and XTSY_SAAS_API_URL / XTSY_SAAS_API_KEY are set.
 * While off, reads fall back to the static catalogue and writes are not forwarded.
 */
export interface SaasConfig { baseUrl: string; apiKey: string }

export function getSaasConfig(): SaasConfig | null {
  if (process.env.XTSY_SAAS_ENABLED !== 'true') return null;
  const baseUrl = process.env.XTSY_SAAS_API_URL;
  const apiKey = process.env.XTSY_SAAS_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

export async function saasRequest<T>(cfg: SaasConfig, path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const res = await fetch(new URL(path, cfg.baseUrl), {
    method: init.method,
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': cfg.apiKey },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`posbyxtsy.club ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}
