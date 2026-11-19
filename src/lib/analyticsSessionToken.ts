// Holds the server-issued token that proves this browser owns its analytics
// session id (see supabase/functions/_shared/sessionToken.ts). Session storage
// only, cleared with the other analytics keys when consent is withdrawn.

export const SESSION_TOKEN_KEY = "xtsy_session_token";

type Stored = { sessionId: string; token: string };

export function readSessionToken(sessionId: unknown): string | undefined {
  if (typeof sessionId !== "string") return undefined;
  try {
    const raw = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!raw) return undefined;
    const s = JSON.parse(raw) as Stored;
    return s.sessionId === sessionId && typeof s.token === "string"
      ? s.token
      : undefined;
  } catch {
    return undefined;
  }
}

export function rememberSessionToken(
  sessionId: unknown,
  response: unknown,
): void {
  if (
    typeof sessionId !== "string" ||
    !response ||
    typeof response !== "object"
  )
    return;
  const token = (response as { sessionToken?: unknown }).sessionToken;
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return;
  try {
    sessionStorage.setItem(
      SESSION_TOKEN_KEY,
      JSON.stringify({ sessionId, token } satisfies Stored),
    );
  } catch {
    /* storage blocked: the next session simply starts unverified */
  }
}

/** Unguessable session id; falls back only where crypto.randomUUID is missing. */
export function newAnalyticsSessionId(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return "s_" + crypto.randomUUID().replace(/-/g, "");
    }
  } catch {
    /* fall through */
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return (
    "s_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

/** Adds the token for realtime pings; other endpoints are sent unchanged. */
export function withSessionToken(
  endpoint: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (endpoint !== "realtime") return data;
  const token = readSessionToken(data.sessionId);
  return token ? { ...data, sessionToken: token } : data;
}
