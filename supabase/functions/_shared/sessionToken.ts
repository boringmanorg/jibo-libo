// Proof that a caller owns an analytics session id.
// The server signs the session id once, for whoever first creates the record,
// and later overwrites of that record require the signature back.
// Plain WebCrypto so it runs in Deno (edge functions) and in Node (tests).

const LABEL = 'xtsy-analytics-session:v1:';
const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidSessionId(id: unknown): id is string {
  return typeof id === 'string' && SESSION_ID_RE.test(id);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signSessionToken(secret: string, sessionId: string): Promise<string> {
  if (!secret) throw new Error('session token secret missing');
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(LABEL + sessionId));
  return toHex(sig);
}

export async function verifySessionToken(secret: string, sessionId: string, token: unknown): Promise<boolean> {
  if (!secret || !isValidSessionId(sessionId) || typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false;
  const expected = await signSessionToken(secret, sessionId);
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
